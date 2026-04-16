package com.ecommerce.commerce.client;

import com.ecommerce.commerce.dto.CouponConsumeRequest;
import com.ecommerce.commerce.dto.CouponValidationRequest;
import com.ecommerce.commerce.dto.CouponValidationResponse;
import com.ecommerce.commerce.dto.ProductSnapshotRequest;
import com.ecommerce.commerce.dto.ProductSnapshotResponse;
import com.ecommerce.shared.web.BusinessException;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Component
public class CatalogClient {

    private final RestClient catalogRestClient;

    public CatalogClient(@Qualifier("catalogRestClient") RestClient catalogRestClient) {
        this.catalogRestClient = catalogRestClient;
    }

    @Bulkhead(name = "catalogService")
    @Retry(name = "catalogService")
    @CircuitBreaker(name = "catalogService", fallbackMethod = "productFallback")
    public List<ProductSnapshotResponse> getProductSnapshots(List<Long> productIds) {
        return catalogRestClient.post()
                .uri("/internal/catalog/products/snapshots")
                .body(new ProductSnapshotRequest(productIds))
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }

    @Bulkhead(name = "catalogService")
    @Retry(name = "catalogService")
    @CircuitBreaker(name = "catalogService", fallbackMethod = "couponFallback")
    public CouponValidationResponse validateCoupon(String code, BigDecimal orderValue) {
        return catalogRestClient.post()
                .uri("/catalog/coupons/validate")
                .body(new CouponValidationRequest(code, orderValue))
                .retrieve()
                .body(CouponValidationResponse.class);
    }

    @Bulkhead(name = "catalogService")
    @Retry(name = "catalogService")
    @CircuitBreaker(name = "catalogService", fallbackMethod = "consumeFallback")
    public void consumeCoupon(Long couponId, UUID userId, Long orderId) {
        catalogRestClient.post()
                .uri("/internal/catalog/coupons/consume")
                .body(new CouponConsumeRequest(couponId, userId, orderId))
                .retrieve()
                .toBodilessEntity();
    }

    public List<ProductSnapshotResponse> productFallback(List<Long> productIds, Throwable throwable) {
        throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Catalog service is unavailable");
    }

    public CouponValidationResponse couponFallback(String code, BigDecimal orderValue, Throwable throwable) {
        throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Coupon service is unavailable");
    }

    public void consumeFallback(Long couponId, UUID userId, Long orderId, Throwable throwable) {
        throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Coupon consume flow is unavailable");
    }
}
