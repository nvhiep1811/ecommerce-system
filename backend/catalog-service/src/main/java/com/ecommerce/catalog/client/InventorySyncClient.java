package com.ecommerce.catalog.client;

import com.ecommerce.catalog.dto.InventoryUpsertRequest;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class InventorySyncClient {

    private final RestClient commerceRestClient;

    public InventorySyncClient(RestClient commerceRestClient) {
        this.commerceRestClient = commerceRestClient;
    }

    @Bulkhead(name = "inventorySync")
    @Retry(name = "inventorySync", fallbackMethod = "fallback")
    public void upsertStock(Long productId, Integer stock) {
        commerceRestClient.post()
                .uri("/internal/commerce/inventory/upsert")
                .body(new InventoryUpsertRequest(productId, stock))
                .retrieve()
                .toBodilessEntity();
    }

    public void fallback(Long productId, Integer stock, Throwable throwable) {
        throw new IllegalStateException("Inventory sync is unavailable", throwable);
    }
}
