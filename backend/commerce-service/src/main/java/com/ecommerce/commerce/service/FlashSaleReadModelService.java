package com.ecommerce.commerce.service;

import com.ecommerce.commerce.event.FlashSaleClaimedEvent;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class FlashSaleReadModelService {

    private static final String READ_MODEL_KEY_PREFIX = "flashsale:read";

    private final RedisTemplate<String, Object> redisTemplate;

    public FlashSaleReadModelService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private String hashKey(String saleId) {
        return String.format("%s:%s", READ_MODEL_KEY_PREFIX, saleId);
    }

    private String processedSetKey(String saleId) {
        return hashKey(saleId) + ":processed";
    }

    /**
     * Apply a claimed event to the read‑model stored in Redis.
     * Increments the claimed quantity for the sale and records the eventId for idempotency.
     */
    public void applyClaimedEvent(FlashSaleClaimedEvent event) {
        String hashKey = hashKey(event.getSaleId());
        // Increment total claimed quantity
        redisTemplate.opsForHash().increment(hashKey, "claimedQuantity", event.getQuantity());
        // Record processed event id
        redisTemplate.opsForSet().add(processedSetKey(event.getSaleId()), event.getEventId());
    }

    /**
     * Retrieve the total claimed quantity for a given flash‑sale.
     */
    public Long getClaimedQuantity(String saleId) {
        Object value = redisTemplate.opsForHash().get(hashKey(saleId), "claimedQuantity");
        return value == null ? 0L : Long.valueOf(value.toString());
    }

    /**
     * Check whether an event has already been applied (idempotency).
     */
    public boolean isEventProcessed(String saleId, String eventId) {
        Boolean member = redisTemplate.opsForSet().isMember(processedSetKey(saleId), eventId);
        return Boolean.TRUE.equals(member);
    }
}
