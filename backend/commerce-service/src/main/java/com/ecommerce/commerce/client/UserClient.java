package com.ecommerce.commerce.client;

import com.ecommerce.commerce.dto.AddressSnapshotResponse;
import com.ecommerce.shared.web.BusinessException;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class UserClient {

    private final RestClient userRestClient;

    public UserClient(RestClient userRestClient) {
        this.userRestClient = userRestClient;
    }

    @Bulkhead(name = "userService")
    @Retry(name = "userService")
    @CircuitBreaker(name = "userService", fallbackMethod = "fallback")
    public AddressSnapshotResponse getAddress(Long addressId) {
        return userRestClient.get()
                .uri("/internal/users/addresses/{id}", addressId)
                .retrieve()
                .body(AddressSnapshotResponse.class);
    }

    public AddressSnapshotResponse fallback(Long addressId, Throwable throwable) {
        throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "User service is unavailable");
    }
}
