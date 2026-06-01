package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.CatalogClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.UUID;

@Service
@Slf4j
public class CouponConsumptionService {

    private final CatalogClient catalogClient;

    public CouponConsumptionService(CatalogClient catalogClient) {
        this.catalogClient = catalogClient;
    }

    /**
     * Consume coupon sau khi transaction chính commit thành công.
     * Nếu đang trong transaction thì đăng ký afterCommit hook.
     * Nếu không có transaction (unit test, direct call) thì gọi trực tiếp.
     */
    public void consumeAfterCommit(Long couponId, UUID userId, Long orderId) {
        Runnable consumeAction = () -> {
            try {
                catalogClient.consumeCoupon(couponId, userId, orderId);
            } catch (Exception exception) {
                log.error("Failed to consume coupon {} for order {}", couponId, orderId, exception);
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    consumeAction.run();
                }
            });
            return;
        }

        consumeAction.run();
    }
}