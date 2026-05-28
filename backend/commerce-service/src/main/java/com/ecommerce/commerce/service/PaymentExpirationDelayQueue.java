package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.PaymentExpirationQueueProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@ConditionalOnProperty(prefix = "payment.expiration-queue", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PaymentExpirationDelayQueue {

    private static final String MEMBER_PREFIX = "payment:";

    private final StringRedisTemplate redisTemplate;
    private final PaymentExpirationQueueProperties properties;

    public PaymentExpirationDelayQueue(
            StringRedisTemplate redisTemplate,
            PaymentExpirationQueueProperties properties
    ) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    public void schedule(Long paymentId, OffsetDateTime expiredAt) {
        if (paymentId == null) {
            throw new IllegalArgumentException("paymentId is required for payment expiration scheduling");
        }
        if (expiredAt == null) {
            throw new IllegalArgumentException("expiredAt is required for payment expiration scheduling");
        }
        redisTemplate.opsForZSet().add(properties.getRedisKey(), member(paymentId), score(expiredAt));
        log.debug("Scheduled payment {} expiration at {}", paymentId, expiredAt);
    }

    public List<Long> duePaymentIds(OffsetDateTime now) {
        long batchSize = Math.max(1, properties.getBatchSize());
        Set<String> members = redisTemplate.opsForZSet()
                .rangeByScore(properties.getRedisKey(), 0, score(now), 0, batchSize);
        if (members == null || members.isEmpty()) {
            return List.of();
        }
        return members.stream()
                .map(this::paymentId)
                .flatMap(List::stream)
                .toList();
    }

    public void remove(Long paymentId) {
        if (paymentId != null) {
            redisTemplate.opsForZSet().remove(properties.getRedisKey(), member(paymentId));
        }
    }

    private String member(Long paymentId) {
        return MEMBER_PREFIX + paymentId;
    }

    private List<Long> paymentId(String member) {
        if (member == null) {
            return List.of();
        }
        if (!member.startsWith(MEMBER_PREFIX)) {
            log.warn("Discarding malformed payment expiration queue member {}", member);
            redisTemplate.opsForZSet().remove(properties.getRedisKey(), member);
            return List.of();
        }
        try {
            return List.of(Long.parseLong(member.substring(MEMBER_PREFIX.length())));
        } catch (NumberFormatException exception) {
            log.warn("Discarding malformed payment expiration queue member {}", member);
            redisTemplate.opsForZSet().remove(properties.getRedisKey(), member);
            return List.of();
        }
    }

    private double score(OffsetDateTime value) {
        return value.toInstant().toEpochMilli();
    }
}
