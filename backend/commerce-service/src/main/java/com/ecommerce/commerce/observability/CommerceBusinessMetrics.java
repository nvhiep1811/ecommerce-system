package com.ecommerce.commerce.observability;

import com.ecommerce.commerce.service.PaymentConstants;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;

@Service
public class CommerceBusinessMetrics {

    private final MeterRegistry registry;

    public CommerceBusinessMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public long startTimer() {
        return System.nanoTime();
    }

    public String paymentMethodTag(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return PaymentConstants.METHOD_COD;
        }
        String normalized = paymentMethod.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case PaymentConstants.METHOD_COD,
                 PaymentConstants.METHOD_SEPAY_QR,
                 PaymentConstants.METHOD_SEPAY_CHECKOUT,
                 PaymentConstants.METHOD_SEPAY_CARD,
                 PaymentConstants.METHOD_APPLE_PAY,
                 PaymentConstants.METHOD_GOOGLE_PAY,
                 "MOMO",
                 "MEGAPAY",
                 "CARD",
                 "BANK_TRANSFER",
                 "VNPAY",
                 "PAYPAL" -> normalized;
            default -> "OTHER";
        };
    }

    public void recordCheckout(String result, String paymentMethod, long startedNanos) {
        Tags tags = Tags.of("result", result, "payment_method", paymentMethodTag(paymentMethod));
        counter("ecommerce.checkout.orders", tags).increment();
        timer("ecommerce.checkout.duration", tags, startedNanos);
    }

    public void recordPaymentWebhook(String provider, String result, long startedNanos) {
        Tags tags = Tags.of("provider", safeTag(provider), "result", result);
        counter("ecommerce.payment.webhooks", tags).increment();
        timer("ecommerce.payment.webhook.duration", tags, startedNanos);
    }

    public void recordPaymentExpiration(String result) {
        counter("ecommerce.payment.expirations", Tags.of("result", result)).increment();
    }

    public void recordPaymentExpirationQueue(String result) {
        recordPaymentExpirationQueue(result, 1);
    }

    public void recordPaymentExpirationQueue(String result, int amount) {
        if (amount <= 0) {
            return;
        }
        counter("ecommerce.payment.expiration.queue.jobs", Tags.of("result", result)).increment(amount);
    }

    public void recordPaymentExpirationSchedule(String result) {
        counter("ecommerce.payment.expiration.schedules", Tags.of("result", result)).increment();
    }

    public void recordNotification(String channel, String result) {
        counter("ecommerce.notifications", Tags.of("channel", safeTag(channel), "result", result)).increment();
    }

    private Counter counter(String name, Tags tags) {
        return Counter.builder(name).tags(tags).register(registry);
    }

    private void timer(String name, Tags tags, long startedNanos) {
        long elapsedNanos = Math.max(0, System.nanoTime() - startedNanos);
        Timer.builder(name).tags(tags).register(registry).record(Duration.ofNanos(elapsedNanos));
    }

    private String safeTag(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_.-]", "_");
    }
}
