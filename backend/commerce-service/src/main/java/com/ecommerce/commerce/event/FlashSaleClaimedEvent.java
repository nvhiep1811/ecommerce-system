package com.ecommerce.commerce.event;

import java.time.Instant;
import java.util.UUID;

/**
 * Event emitted when a flash‑sale claim is successfully processed.
 * This event is used by the read‑model side to update the cached stock in Redis.
 */
public class FlashSaleClaimedEvent {
    private final String saleId;
    private final String userId;
    private final int quantity;
    private final Instant timestamp;
    private final String eventId;

    public FlashSaleClaimedEvent(String saleId, String userId, int quantity) {
        this.saleId = saleId;
        this.userId = userId;
        this.quantity = quantity;
        this.timestamp = Instant.now();
        this.eventId = UUID.randomUUID().toString();
    }

    public String getSaleId() { return saleId; }
    public String getUserId() { return userId; }
    public int getQuantity() { return quantity; }
    public Instant getTimestamp() { return timestamp; }
    public String getEventId() { return eventId; }
}
