package com.ecommerce.commerce.observability;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CommerceBusinessMetricsTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final CommerceBusinessMetrics metrics = new CommerceBusinessMetrics(registry);

    @Test
    void shouldRecordCheckoutCountersAndTimersWithBoundedTags() {
        metrics.recordCheckout("created", "sepay_qr", System.nanoTime() - 1_000_000);
        metrics.recordCheckout("created", "unexpected-wallet", System.nanoTime() - 1_000_000);

        assertEquals(1, registry.get("ecommerce.checkout.orders")
                .tag("result", "created")
                .tag("payment_method", "SEPAY_QR")
                .counter()
                .count());
        assertEquals(1, registry.get("ecommerce.checkout.orders")
                .tag("result", "created")
                .tag("payment_method", "OTHER")
                .counter()
                .count());
        assertEquals(2, registry.get("ecommerce.checkout.duration")
                .tag("result", "created")
                .timers()
                .stream()
                .mapToLong(timer -> timer.count())
                .sum());
    }

    @Test
    void shouldRecordPaymentAndNotificationMetrics() {
        metrics.recordPaymentWebhook("SePay", "confirmed", System.nanoTime() - 1_000_000);
        metrics.recordPaymentExpiration("expired");
        metrics.recordPaymentExpirationQueue("due", 3);
        metrics.recordPaymentExpirationSchedule("scheduled");
        metrics.recordNotification("Email", "sent");

        assertEquals(1, registry.get("ecommerce.payment.webhooks")
                .tag("provider", "sepay")
                .tag("result", "confirmed")
                .counter()
                .count());
        assertEquals(1, registry.get("ecommerce.payment.expirations")
                .tag("result", "expired")
                .counter()
                .count());
        assertEquals(3, registry.get("ecommerce.payment.expiration.queue.jobs")
                .tag("result", "due")
                .counter()
                .count());
        assertEquals(1, registry.get("ecommerce.payment.expiration.schedules")
                .tag("result", "scheduled")
                .counter()
                .count());
        assertEquals(1, registry.get("ecommerce.notifications")
                .tag("channel", "email")
                .tag("result", "sent")
                .counter()
                .count());
    }
}
