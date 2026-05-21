package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class RedisFlashSaleStockStore implements FlashSaleStockStore {

    private static final RedisScript<List> PRELOAD_SCRIPT = RedisScript.of("""
            redis.call('SET', KEYS[1], ARGV[1])
            redis.call('DEL', KEYS[2], KEYS[3], KEYS[4])
            redis.call('SET', KEYS[5], ARGV[2])
            return {'PRELOADED', ARGV[1], ARGV[2]}
            """, List.class);

    private static final RedisScript<List> CLAIM_SCRIPT = RedisScript.of("""
            local existingToken = redis.call('GET', KEYS[4])
            if existingToken then
              local existingData = redis.call('HGET', KEYS[3], existingToken)
              local remaining = redis.call('GET', KEYS[1]) or '0'
              if existingData then
                return {'DUPLICATE', existingToken, tostring(remaining), existingData}
              end
              redis.call('DEL', KEYS[4])
            end

            local stock = tonumber(redis.call('GET', KEYS[1]) or '-1')
            if stock < 0 then
              return {'NOT_PRELOADED', '', '0', ''}
            end

            local quantity = tonumber(ARGV[2])
            if quantity == nil or quantity <= 0 then
              return {'INVALID_QUANTITY', '', tostring(stock), ''}
            end

            local perUserLimit = tonumber(redis.call('GET', KEYS[6]) or '1')
            local currentQuantity = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0')
            if currentQuantity + quantity > perUserLimit then
              return {'LIMIT_EXCEEDED', '', tostring(stock), ''}
            end

            if stock < quantity then
              return {'SOLD_OUT', '', tostring(stock), ''}
            end

            local remaining = redis.call('DECRBY', KEYS[1], quantity)
            redis.call('HINCRBY', KEYS[2], ARGV[1], quantity)
            local reservationData = ARGV[1] .. '|' .. ARGV[2] .. '|' .. ARGV[6]
            redis.call('HSET', KEYS[3], ARGV[4], reservationData)
            redis.call('ZADD', KEYS[5], ARGV[6], ARGV[4])
            redis.call('SET', KEYS[4], ARGV[4], 'EX', ARGV[3])
            return {'RESERVED', ARGV[4], tostring(remaining), reservationData}
            """, List.class);

    private static final RedisScript<List> RELEASE_SCRIPT = RedisScript.of("""
            local reservationData = redis.call('HGET', KEYS[3], ARGV[1])
            if not reservationData then
              return {'NOT_FOUND'}
            end

            local userId, quantity, expiresAt = string.match(reservationData, '([^|]+)|([^|]+)|([^|]+)')
            if not quantity then
              return {'CORRUPTED'}
            end

            redis.call('HDEL', KEYS[3], ARGV[1])
            redis.call('ZREM', KEYS[4], ARGV[1])
            redis.call('INCRBY', KEYS[1], tonumber(quantity))
            local remainingBuyerQuantity = redis.call('HINCRBY', KEYS[2], userId, -tonumber(quantity))
            if remainingBuyerQuantity <= 0 then
              redis.call('HDEL', KEYS[2], userId)
            end
            return {'RELEASED', quantity}
            """, List.class);

    private final StringRedisTemplate redisTemplate;
    private final FlashSaleProperties properties;

    public RedisFlashSaleStockStore(StringRedisTemplate redisTemplate, FlashSaleProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    @Override
    public void preload(Long campaignId, Long itemId, Integer stock, Integer perUserLimit) {
        redisTemplate.execute(
                PRELOAD_SCRIPT,
                List.of(stockKey(campaignId, itemId), buyersKey(campaignId, itemId), reservationsKey(campaignId, itemId),
                        expirationsKey(campaignId, itemId), limitKey(campaignId, itemId)),
                String.valueOf(stock),
                String.valueOf(perUserLimit)
        );
    }

    @Override
    public FlashSaleClaimResult claim(FlashSaleClaimCommand command, long ttlSeconds) {
        String reservationToken = "fsr_" + UUID.randomUUID();
        long expiresAtEpochSecond = Instant.now().plusSeconds(ttlSeconds).getEpochSecond();
        List<?> raw = redisTemplate.execute(
                CLAIM_SCRIPT,
                List.of(stockKey(command.campaignId(), command.itemId()), buyersKey(command.campaignId(), command.itemId()),
                        reservationsKey(command.campaignId(), command.itemId()), requestKey(command.campaignId(), command.itemId(), command.requestId()),
                        expirationsKey(command.campaignId(), command.itemId()), limitKey(command.campaignId(), command.itemId())),
                command.userId().toString(),
                String.valueOf(command.quantity()),
                String.valueOf(ttlSeconds),
                reservationToken,
                String.valueOf(Instant.now().getEpochSecond()),
                String.valueOf(expiresAtEpochSecond)
        );

        if (raw == null || raw.isEmpty()) {
            return new FlashSaleClaimResult("ERROR", null, command.quantity(), 0L, null);
        }

        String status = asString(raw.get(0));
        String token = raw.size() > 1 ? blankToNull(asString(raw.get(1))) : null;
        Long remaining = raw.size() > 2 ? parseLong(raw.get(2), 0L) : 0L;
        ReservationData data = raw.size() > 3 ? parseReservationData(asString(raw.get(3))) : null;
        OffsetDateTime expiresAt = data != null
                ? OffsetDateTime.ofInstant(Instant.ofEpochSecond(data.expiresAtEpochSecond()), ZoneOffset.UTC)
                : null;
        Integer quantity = data != null ? data.quantity() : command.quantity();
        return new FlashSaleClaimResult(status, token, quantity, remaining, expiresAt);
    }

    @Override
    public void release(Long campaignId, Long itemId, String reservationToken) {
        redisTemplate.execute(
                RELEASE_SCRIPT,
                List.of(stockKey(campaignId, itemId), buyersKey(campaignId, itemId), reservationsKey(campaignId, itemId),
                        expirationsKey(campaignId, itemId)),
                reservationToken
        );
    }

    private String stockKey(Long campaignId, Long itemId) {
        return baseKey(campaignId, itemId) + ":stock";
    }

    private String buyersKey(Long campaignId, Long itemId) {
        return baseKey(campaignId, itemId) + ":buyers";
    }

    private String reservationsKey(Long campaignId, Long itemId) {
        return baseKey(campaignId, itemId) + ":reservations";
    }

    private String requestKey(Long campaignId, Long itemId, String requestId) {
        return baseKey(campaignId, itemId) + ":request:" + requestId;
    }

    private String expirationsKey(Long campaignId, Long itemId) {
        return baseKey(campaignId, itemId) + ":reservation-expirations";
    }

    private String limitKey(Long campaignId, Long itemId) {
        return baseKey(campaignId, itemId) + ":per-user-limit";
    }

    private String baseKey(Long campaignId, Long itemId) {
        return properties.getKeyPrefix() + ":{" + campaignId + ":" + itemId + "}";
    }

    private static String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static Long parseLong(Object value, Long fallback) {
        try {
            return Long.parseLong(asString(value));
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private static ReservationData parseReservationData(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String[] parts = value.split("\\|");
        if (parts.length != 3) {
            return null;
        }
        try {
            return new ReservationData(Integer.parseInt(parts[1]), Long.parseLong(parts[2]));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private record ReservationData(Integer quantity, Long expiresAtEpochSecond) {
    }
}
