package com.ecommerce.commerce.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.Comparator;
import java.util.LinkedHashMap;
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

    private static final String INCREMENT_RESERVED_COUNT_SQL = """
            update public.flash_sale_items
            set reserved_count = reserved_count + ?,
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

    private static final String APPLY_RELEASED_RESERVATION_SQL = """
            with updated_reservation as (
                update public.flash_sale_reservations
                set status = ?,
                    released_at = ?,
                    updated_at = now(),
                    version = version + 1
                where reservation_token = ?
                  and status = 'reserved'
                returning campaign_id, item_id, quantity
            )
            update public.flash_sale_items item
            set reserved_count = greatest(item.reserved_count - updated_reservation.quantity, 0),
                updated_at = now(),
                version = version + 1
            from updated_reservation
            where item.id = updated_reservation.item_id
              and item.campaign_id = updated_reservation.campaign_id
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

    private final JdbcTemplate jdbcTemplate;

    public FlashSaleReservationSyncService(JdbcTemplate jdbcTemplate) {
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

        applyReservedDeltas(reservedPayloads, insertedRows);

        if (insertedRows.length != reservedPayloads.size()) {
            log.debug("Flash sale batch insert returned {} row counts for {} payloads",
                    insertedRows.length, reservedPayloads.size());
        }
    }

    @Transactional
    public void resetProjection(Long campaignId, Long itemId) {
        ItemKey key = new ItemKey(campaignId, itemId);
        int deletedRows = jdbcTemplate.update(DELETE_ITEM_PROJECTION_SQL, campaignId, itemId);
        refreshItemCounts(key);
        log.warn("Reset flash sale projection for campaign {} item {}; deleted {} unlinked reservation row(s)",
                campaignId, itemId, deletedRows);
    }

    private void handleReserved(FlashSaleEventPayload payload) {
        if (!isValidReservedPayload(payload)) {
            return;
        }

        ItemKey key = new ItemKey(payload.campaignId(), payload.itemId());
        int insertedRows = jdbcTemplate.update(
                INSERT_RESERVED_SQL,
                payload.campaignId(),
                payload.itemId(),
                payload.userId(),
                payload.requestId(),
                payload.reservationToken(),
                payload.quantity(),
                payload.expiresAt()
        );
        if (insertedRows == 0) {
            log.info("Skip duplicate flash sale reservation event {}", payload.eventId());
        } else {
            incrementReservedCount(key, payload.quantity());
        }
    }

    private void handleReleased(FlashSaleEventPayload payload, String status) {
        if (!isValidReleasePayload(payload)) {
            log.warn("Skip invalid flash sale release event {}", payload.eventId());
            return;
        }

        int updatedRows = jdbcTemplate.update(
                APPLY_RELEASED_RESERVATION_SQL,
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

    private void applyReservedDeltas(List<FlashSaleEventPayload> reservedPayloads, int[] insertedRows) {
        List<ItemKey> affectedItems = affectedItemKeys(reservedPayloads);
        if (insertedRows.length != reservedPayloads.size() || hasUnknownRowCounts(insertedRows)) {
            log.debug("Flash sale batch insert did not return per-row counts; refreshing {} affected item count(s)",
                    affectedItems.size());
            affectedItems.forEach(this::refreshItemCounts);
            return;
        }

        Map<ItemKey, Integer> incrementsByItem = new LinkedHashMap<>();
        for (int index = 0; index < insertedRows.length; index++) {
            if (insertedRows[index] <= 0) {
                continue;
            }
            FlashSaleEventPayload payload = reservedPayloads.get(index);
            incrementsByItem.merge(
                    new ItemKey(payload.campaignId(), payload.itemId()),
                    payload.quantity(),
                    Integer::sum
            );
        }
        incrementsByItem.forEach(this::incrementReservedCount);
    }

    private boolean hasUnknownRowCounts(int[] rowCounts) {
        for (int rowCount : rowCounts) {
            if (rowCount == Statement.SUCCESS_NO_INFO) {
                return true;
            }
        }
        return false;
    }

    private void incrementReservedCount(ItemKey key, int quantity) {
        if (quantity <= 0) {
            return;
        }
        jdbcTemplate.update(
                INCREMENT_RESERVED_COUNT_SQL,
                quantity,
                key.itemId(),
                key.campaignId()
        );
    }

    private List<ItemKey> affectedItemKeys(List<FlashSaleEventPayload> payloads) {
        return payloads.stream()
                .map(payload -> new ItemKey(payload.campaignId(), payload.itemId()))
                .distinct()
                .sorted(Comparator.comparing(ItemKey::campaignId).thenComparing(ItemKey::itemId))
                .toList();
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
