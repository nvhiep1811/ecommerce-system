package com.ecommerce.catalog.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Component
public class ProductPageReadCache {

    private static final String STORE_LOCAL = "local";
    private static final String STORE_REDIS = "redis";
    private static final String STORE_AUTO = "auto";
    private static final String REDIS_KEY_PREFIX = "catalog:product-page:";
    private static final String REDIS_KEY_INDEX = REDIS_KEY_PREFIX + "keys";

    private final boolean enabled;
    private final String store;
    private final long ttlMillis;
    private final Duration ttl;
    private final int maxEntries;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final ConcurrentMap<Key, Entry> entries = new ConcurrentHashMap<>();

    public ProductPageReadCache(
            @Value("${catalog.read-cache.enabled:true}") boolean enabled,
            @Value("${catalog.read-cache.ttl-seconds:15}") long ttlSeconds,
            @Value("${catalog.read-cache.max-entries:500}") int maxEntries,
            @Value("${catalog.read-cache.store:auto}") String store,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            ObjectMapper objectMapper
    ) {
        this.enabled = enabled;
        this.store = normalizeStore(store);
        this.ttlMillis = Math.max(1, ttlSeconds) * 1000;
        this.ttl = Duration.ofMillis(ttlMillis);
        this.maxEntries = Math.max(10, maxEntries);
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
        this.objectMapper = objectMapper;
    }

    public ProductPageReadCache(boolean enabled, long ttlSeconds, int maxEntries) {
        this.enabled = enabled;
        this.store = STORE_LOCAL;
        this.ttlMillis = Math.max(1, ttlSeconds) * 1000;
        this.ttl = Duration.ofMillis(ttlMillis);
        this.maxEntries = Math.max(10, maxEntries);
        this.redisTemplate = null;
        this.objectMapper = new ObjectMapper();
    }

    public Optional<CachedPage> get(Key key) {
        if (!enabled) {
            return Optional.empty();
        }

        if (shouldUseRedis()) {
            Optional<CachedPage> cached = getFromRedis(key);
            if (cached.isPresent() || STORE_REDIS.equals(store)) {
                return cached;
            }
        }

        return getFromLocal(key);
    }

    public void put(Key key, CachedPage page) {
        if (!enabled) {
            return;
        }

        if (shouldUseRedis()) {
            boolean stored = putToRedis(key, page);
            if (stored && STORE_REDIS.equals(store)) {
                return;
            }
        }

        putToLocal(key, page);
    }

    public void evictAll() {
        entries.clear();
        if (shouldUseRedis()) {
            evictRedis();
        }
    }

    private Optional<CachedPage> getFromLocal(Key key) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.isExpired()) {
            entries.remove(key, entry);
            return Optional.empty();
        }
        return Optional.of(entry.page());
    }

    private void putToLocal(Key key, CachedPage page) {
        if (entries.size() >= maxEntries) {
            evictExpired();
        }
        if (entries.size() >= maxEntries) {
            entries.clear();
        }

        entries.put(key, new Entry(page, System.currentTimeMillis() + ttlMillis));
    }

    private Optional<CachedPage> getFromRedis(Key key) {
        try {
            String payload = redisTemplate.opsForValue().get(redisKey(key));
            if (payload == null || payload.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(payload, CachedPage.class));
        } catch (Exception exception) {
            log.warn("Catalog Redis read cache is unavailable; falling back to local cache");
            return Optional.empty();
        }
    }

    private boolean putToRedis(Key key, CachedPage page) {
        try {
            String redisKey = redisKey(key);
            redisTemplate.opsForValue().set(redisKey, objectMapper.writeValueAsString(page), ttl);
            redisTemplate.opsForSet().add(REDIS_KEY_INDEX, redisKey);
            redisTemplate.expire(REDIS_KEY_INDEX, ttl.multipliedBy(2));
            return true;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize product page cache", exception);
        } catch (Exception exception) {
            log.warn("Catalog Redis write cache is unavailable; falling back to local cache");
            return false;
        }
    }

    private void evictRedis() {
        try {
            Set<String> keys = redisTemplate.opsForSet().members(REDIS_KEY_INDEX);
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
            }
            redisTemplate.delete(REDIS_KEY_INDEX);
        } catch (Exception exception) {
            log.warn("Catalog Redis cache eviction failed; local cache was already cleared");
        }
    }

    private boolean shouldUseRedis() {
        return redisTemplate != null && (STORE_REDIS.equals(store) || STORE_AUTO.equals(store));
    }

    private String normalizeStore(String value) {
        if (value == null || value.isBlank()) {
            return STORE_AUTO;
        }
        String normalized = value.trim().toLowerCase();
        if (STORE_LOCAL.equals(normalized) || STORE_REDIS.equals(normalized) || STORE_AUTO.equals(normalized)) {
            return normalized;
        }
        return STORE_AUTO;
    }

    private String redisKey(Key key) {
        return REDIS_KEY_PREFIX + sha256(key.toString());
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private void evictExpired() {
        entries.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }

    public record Key(
            Long categoryId,
            String search,
            boolean featured,
            int page,
            int size,
            String sort,
            String direction
    ) {
    }

    public record CachedPage(
            List<Long> productIds,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean hasNext
    ) {
    }

    private record Entry(CachedPage page, long expiresAtMillis) {

        private boolean isExpired() {
            return System.currentTimeMillis() > expiresAtMillis;
        }
    }
}
