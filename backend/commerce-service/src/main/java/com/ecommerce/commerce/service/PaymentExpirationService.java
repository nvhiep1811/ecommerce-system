package com.ecommerce.commerce.service;

import com.ecommerce.commerce.observability.CommerceBusinessMetrics;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Service
@ConditionalOnProperty(prefix = "payment.expiration-queue", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PaymentExpirationService {

    private final PaymentService paymentService;
    private final PaymentExpirationDelayQueue delayQueue;
    private final CommerceBusinessMetrics businessMetrics;

    public PaymentExpirationService(
            PaymentService paymentService,
            PaymentExpirationDelayQueue delayQueue,
            CommerceBusinessMetrics businessMetrics
    ) {
        this.paymentService = paymentService;
        this.delayQueue = delayQueue;
        this.businessMetrics = businessMetrics;
    }

    @Scheduled(fixedDelayString = "${payment.expiration-queue.poll-delay-ms:1000}")
    public void expireDuePayments() {
        OffsetDateTime now = OffsetDateTime.now();
        List<Long> paymentIds;
        try {
            paymentIds = delayQueue.duePaymentIds(now);
            businessMetrics.recordPaymentExpirationQueue("due", paymentIds.size());
        } catch (Exception exception) {
            log.error("Failed to read due payment expiration jobs from Redis", exception);
            businessMetrics.recordPaymentExpirationQueue("read_error");
            return;
        }

        for (Long paymentId : paymentIds) {
            try {
                boolean handled = paymentService.expirePaymentIfDue(paymentId, now);
                if (handled) {
                    delayQueue.remove(paymentId);
                    businessMetrics.recordPaymentExpirationQueue("removed");
                }
            } catch (Exception exception) {
                log.error("Failed to expire payment {}", paymentId, exception);
                businessMetrics.recordPaymentExpirationQueue("handler_error");
            }
        }
    }
}
