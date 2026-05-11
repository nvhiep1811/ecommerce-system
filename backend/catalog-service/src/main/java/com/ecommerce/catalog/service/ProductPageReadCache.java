package com.ecommerce.catalog.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class ProductPageReadCache {

    private final boolean enabled;
    private final long ttlMillis;
    private final int maxEntries;
    private final ConcurrentMap<Key, Entry> entries = new ConcurrentHashMap<>();

    public ProductPageReadCache(
            @Value("${catalog.read-cache.enabled:true}") boolean enabled,
            @Value("${catalog.read-cache.ttl-seconds:15}") long ttlSeconds,
            @Value("${catalog.read-cache.max-entries:500}") int maxEntries
    ) {
        this.enabled = enabled;
        this.ttlMillis = Math.max(1, ttlSeconds) * 1000;
        this.maxEntries = Math.max(10, maxEntries);
    }

    public Optional<CachedPage> get(Key key) {
        if (!enabled) {
            return Optional.empty();
        }

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

    public void put(Key key, CachedPage page) {
        if (!enabled) {
            return;
        }

        if (entries.size() >= maxEntries) {
            evictExpired();
        }
        if (entries.size() >= maxEntries) {
            entries.clear();
        }

        entries.put(key, new Entry(page, System.currentTimeMillis() + ttlMillis));
    }

    public void evictAll() {
        entries.clear();
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
