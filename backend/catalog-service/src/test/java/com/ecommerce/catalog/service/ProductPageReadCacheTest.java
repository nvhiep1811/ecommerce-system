package com.ecommerce.catalog.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductPageReadCacheTest {

    @Test
    void cacheShouldStoreAndReturnProductPageIds() {
        ProductPageReadCache cache = new ProductPageReadCache(true, 15, 10);
        ProductPageReadCache.Key key = new ProductPageReadCache.Key(null, "ao thun", false, 0, 10, "createdat", "desc");
        ProductPageReadCache.CachedPage page = new ProductPageReadCache.CachedPage(List.of(1L, 2L), 0, 10, 2, 1, false);

        cache.put(key, page);

        assertTrue(cache.get(key).isPresent());
        assertEquals(List.of(1L, 2L), cache.get(key).orElseThrow().productIds());
    }

    @Test
    void cacheShouldBeBypassedWhenDisabled() {
        ProductPageReadCache cache = new ProductPageReadCache(false, 15, 10);
        ProductPageReadCache.Key key = new ProductPageReadCache.Key(null, "", true, 0, 10, "rating", "desc");
        ProductPageReadCache.CachedPage page = new ProductPageReadCache.CachedPage(List.of(1L), 0, 10, 1, 1, false);

        cache.put(key, page);

        assertTrue(cache.get(key).isEmpty());
    }
}
