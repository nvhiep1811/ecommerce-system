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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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

    private static final String REFRESH_ITEM_COUNTS_SQL = """
            update public.flash_sale_items
            set reserved_count = (
                    select coalesce(sum(reservation.quantity), 0)::int
                    from public.flash_sale_reservations reservation
                    where reservation.campaign_id = ?
                      and reservation.item_id = ?
                      and reservation.status = 'reserved'
                ),
                sold_count = (
                    select coalesce(sum(reservation.quantity), 0)::int
                    from public.flash_sale_reservations reservation
                    where reservation.campaign_id = ?
                      and reservation.item_id = ?
                      and reservation.status = 'confirmed'
                ),
                updated_at = now(),
                version = version + 1
            where id = ?
              and campaign_id = ?
            """;

    private static final String DELETE_ITEM_PROJECTION_SQL = """
            delete from public.flash_sale_reservations
            where campaign_id = ?
              and item_id = ?
              and order_id is null
            """;

    private static final String UPDATE_RELEASED_RESERVATION_SQL = """
            update public.flash_sale_reservations
            set status = ?,
                released_at = ?,
                updated_at = now(),
                version = version + 1
            where reservation_token = ?
              and status = 'reserved'
            """;

    private static final String INSERT_RELEASED_RESERVATION_SQL = """
            insert into public.flash_sale_reservations (
              campaign_id,
              item_id,
              user_id,
              request_id,
              reservation_token,
              quantity,
              status,
              expires_at,
              released_at,
              created_at,
              updated_at
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())
            on conflict do nothing
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
            case "FLASH_SALE_EXPIRED" -> handleReleased(payload, "expired");
            case "FLASH_SALE_RELEASED" -> handleReleased(payload, "released");
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

        Set<ItemKey> affectedItems = new LinkedHashSet<>();
        reservedPayloads.forEach(payload -> affectedItems.add(new ItemKey(payload.campaignId(), payload.itemId())));
        affectedItems.forEach(this::refreshItemCounts);

        if (insertedRows.length != reservedPayloads.size()) {
            log.debug("Flash sale batch insert returned {} row counts for {} payloads",
                    insertedRows.length, reservedPayloads.size());
        }
    }

    @Transactional
    public void resetProjection(Long campaignId, Long itemId) {
        int deletedRows = jdbcTemplate.update(DELETE_ITEM_PROJECTION_SQL, campaignId, itemId);
        refreshItemCounts(new ItemKey(campaignId, itemId));
        log.warn("Reset flash sale projection for campaign {} item {}; deleted {} unlinked reservation row(s)",
                campaignId, itemId, deletedRows);
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
        if (!isValidReleasePayload(payload)) {
            log.warn("Skip invalid flash sale release event {}", payload.eventId());
            return;
        }

        int updatedRows = jdbcTemplate.update(
                UPDATE_RELEASED_RESERVATION_SQL,
                status,
                payload.occurredAt(),
                payload.reservationToken()
        );
        if (updatedRows == 0) {
            int insertedRows = jdbcTemplate.update(
                    INSERT_RELEASED_RESERVATION_SQL,
                    payload.campaignId(),
                    payload.itemId(),
                    payload.userId(),
                    payload.requestId() == null || payload.requestId().isBlank()
                            ? "release-" + payload.reservationToken()
                            : payload.requestId(),
                    payload.reservationToken(),
                    payload.quantity(),
                    status,
                    payload.expiresAt() == null ? payload.occurredAt() : payload.expiresAt(),
                    payload.occurredAt()
            );
            if (insertedRows == 0) {
                log.debug("Skip duplicate flash sale release event {} for reservation {}",
                        payload.eventId(), payload.reservationToken());
            }
        }

        refreshItemCounts(new ItemKey(payload.campaignId(), payload.itemId()));
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

    private void refreshItemCounts(ItemKey key) {
        jdbcTemplate.update(
                REFRESH_ITEM_COUNTS_SQL,
                key.campaignId(),
                key.itemId(),
                key.campaignId(),
                key.itemId(),
                key.itemId(),
                key.campaignId()
        );
    }

    private boolean isValidReleasePayload(FlashSaleEventPayload payload) {
        return payload != null
                && payload.campaignId() != null
                && payload.itemId() != null
                && payload.userId() != null
                && payload.reservationToken() != null
                && !payload.reservationToken().isBlank()
                && payload.quantity() != null
                && payload.quantity() > 0
                && payload.occurredAt() != null;
    }

    private record ItemKey(Long campaignId, Long itemId) {
    }
}
