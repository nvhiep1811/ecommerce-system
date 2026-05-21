package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.commerce.repository.FlashSaleReservationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class FlashSaleReservationSyncService {

    private static final String INSERT_RESERVED_SQL = """
            insert into public.flash_sale_reservations (
              campaign_id,
              item_id,
              user_id,
              request_id,
              reservation_token,
              quantity,
              status,
              expires_at,
              created_at,
              updated_at
            )
            values (?, ?, ?, ?, ?, ?, 'reserved', ?, now(), now())
            on conflict do nothing
            """;

    private static final String INCREMENT_ITEM_RESERVED_SQL = """
            update public.flash_sale_items
            set reserved_count = reserved_count + ?,
                updated_at = now(),
                version = version + 1
            where id = ?
              and campaign_id = ?
            """;

    private final FlashSaleReservationRepository reservationRepository;
    private final FlashSaleItemRepository itemRepository;
    private final JdbcTemplate jdbcTemplate;

    public FlashSaleReservationSyncService(
            FlashSaleReservationRepository reservationRepository,
            FlashSaleItemRepository itemRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.reservationRepository = reservationRepository;
        this.itemRepository = itemRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void sync(FlashSaleEventPayload payload) {
        switch (payload.eventType()) {
            case "FLASH_SALE_RESERVED" -> handleReserved(payload);
            case "FLASH_SALE_EXPIRED", "FLASH_SALE_RELEASED" -> handleReleased(payload, "expired");
            default -> log.debug("Skip unsupported flash sale event type {}", payload.eventType());
        }
    }

    @Transactional
    public void syncReserved(FlashSaleEventPayload payload) {
        if (!"FLASH_SALE_RESERVED".equals(payload.eventType())) {
            return;
        }
        handleReserved(payload);
    }

    @Transactional
    public void syncReservedBatch(List<FlashSaleEventPayload> payloads) {
        List<FlashSaleEventPayload> reservedPayloads = payloads == null ? List.of() : payloads.stream()
                .filter(this::isValidReservedPayload)
                .toList();
        if (reservedPayloads.isEmpty()) {
            return;
        }

        int[] insertedRows = jdbcTemplate.batchUpdate(INSERT_RESERVED_SQL, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int index) throws SQLException {
                FlashSaleEventPayload payload = reservedPayloads.get(index);
                ps.setLong(1, payload.campaignId());
                ps.setLong(2, payload.itemId());
                ps.setObject(3, payload.userId(), Types.OTHER);
                ps.setString(4, payload.requestId());
                ps.setString(5, payload.reservationToken());
                ps.setInt(6, payload.quantity());
                ps.setObject(7, payload.expiresAt());
            }

            @Override
            public int getBatchSize() {
                return reservedPayloads.size();
            }
        });

        Map<ItemKey, Integer> insertedQuantityByItem = new HashMap<>();
        for (int index = 0; index < insertedRows.length; index++) {
            if (insertedRows[index] > 0) {
                FlashSaleEventPayload payload = reservedPayloads.get(index);
                ItemKey key = new ItemKey(payload.campaignId(), payload.itemId());
                insertedQuantityByItem.merge(key, payload.quantity(), Integer::sum);
            }
        }

        insertedQuantityByItem.forEach((key, quantity) ->
                jdbcTemplate.update(INCREMENT_ITEM_RESERVED_SQL, quantity, key.itemId(), key.campaignId()));

        if (insertedRows.length != reservedPayloads.size()) {
            log.debug("Flash sale batch insert returned {} row counts for {} payloads",
                    insertedRows.length, reservedPayloads.size());
        }
    }

    private void handleReserved(FlashSaleEventPayload payload) {
        if (reservationRepository.findByReservationToken(payload.reservationToken()).isPresent()
                || reservationRepository.findByCampaignIdAndItemIdAndUserIdAndRequestId(
                payload.campaignId(),
                payload.itemId(),
                payload.userId(),
                payload.requestId()
        ).isPresent()) {
            log.info("Skip duplicate flash sale reservation event {}", payload.eventId());
            return;
        }

        FlashSaleItemEntity item = itemRepository.findByIdAndCampaignId(payload.itemId(), payload.campaignId())
                .orElseThrow(() -> new IllegalStateException("Flash sale item not found for event " + payload.eventId()));

        FlashSaleReservationEntity reservation = new FlashSaleReservationEntity();
        reservation.setCampaignId(payload.campaignId());
        reservation.setItemId(payload.itemId());
        reservation.setUserId(payload.userId());
        reservation.setRequestId(payload.requestId());
        reservation.setReservationToken(payload.reservationToken());
        reservation.setQuantity(payload.quantity());
        reservation.setStatus("reserved");
        reservation.setExpiresAt(payload.expiresAt());
        reservationRepository.save(reservation);

        item.setReservedCount(item.getReservedCount() + payload.quantity());
        itemRepository.save(item);
    }

    private void handleReleased(FlashSaleEventPayload payload, String status) {
        if (payload.userId() == null || payload.reservationToken() == null || payload.quantity() == null) {
            log.warn("Skip invalid flash sale release event {}", payload.eventId());
            return;
        }

        FlashSaleItemEntity item = itemRepository.findByIdAndCampaignId(payload.itemId(), payload.campaignId())
                .orElseThrow(() -> new IllegalStateException("Flash sale item not found for event " + payload.eventId()));

        reservationRepository.findByReservationToken(payload.reservationToken())
                .ifPresentOrElse(
                        reservation -> releaseExistingReservation(payload, reservation, item, status),
                        () -> createReleasedReservation(payload, item, status)
                );
    }

    private void releaseExistingReservation(
            FlashSaleEventPayload payload,
            FlashSaleReservationEntity reservation,
            FlashSaleItemEntity item,
            String status
    ) {
        if (!"reserved".equalsIgnoreCase(reservation.getStatus())) {
            log.info("Skip duplicate flash sale release event {} for reservation {} with status {}",
                    payload.eventId(), reservation.getReservationToken(), reservation.getStatus());
            return;
        }

        reservation.setStatus(status);
        reservation.setReleasedAt(payload.occurredAt());
        reservationRepository.save(reservation);
        decrementReservedCount(item, payload.quantity());
    }

    private void createReleasedReservation(FlashSaleEventPayload payload, FlashSaleItemEntity item, String status) {
        FlashSaleReservationEntity reservation = new FlashSaleReservationEntity();
        reservation.setCampaignId(payload.campaignId());
        reservation.setItemId(payload.itemId());
        reservation.setUserId(payload.userId());
        reservation.setRequestId(payload.requestId() == null || payload.requestId().isBlank()
                ? "release-" + payload.reservationToken()
                : payload.requestId());
        reservation.setReservationToken(payload.reservationToken());
        reservation.setQuantity(payload.quantity());
        reservation.setStatus(status);
        reservation.setExpiresAt(payload.expiresAt() == null ? payload.occurredAt() : payload.expiresAt());
        reservation.setReleasedAt(payload.occurredAt());
        reservationRepository.save(reservation);
    }

    private void decrementReservedCount(FlashSaleItemEntity item, int quantity) {
        item.setReservedCount(Math.max(0, item.getReservedCount() - quantity));
        itemRepository.save(item);
    }

    private boolean isValidReservedPayload(FlashSaleEventPayload payload) {
        if (payload == null || !"FLASH_SALE_RESERVED".equals(payload.eventType())) {
            return false;
        }
        boolean valid = payload.campaignId() != null
                && payload.itemId() != null
                && payload.userId() != null
                && payload.requestId() != null
                && !payload.requestId().isBlank()
                && payload.reservationToken() != null
                && !payload.reservationToken().isBlank()
                && payload.quantity() != null
                && payload.quantity() > 0
                && payload.expiresAt() != null;
        if (!valid) {
            log.warn("Skip invalid flash sale reserved event {}", payload.eventId());
        }
        return valid;
    }

    private record ItemKey(Long campaignId, Long itemId) {
    }
}
