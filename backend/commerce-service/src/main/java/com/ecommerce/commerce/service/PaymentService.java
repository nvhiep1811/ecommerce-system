package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final List<PaymentMethodStrategy> paymentMethodStrategies;

    public PaymentService(PaymentRepository paymentRepository, List<PaymentMethodStrategy> paymentMethodStrategies) {
        this.paymentRepository = paymentRepository;
        this.paymentMethodStrategies = paymentMethodStrategies;
    }

    @Transactional
    public PaymentEntity createInitialPayment(OrderEntity order) {
        int nextAttempt = paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(order.getId())
                .map(payment -> payment.getAttemptNo() + 1)
                .orElse(1);

        PaymentMethodStrategy strategy = paymentMethodStrategies.stream()
                .filter(candidate -> candidate.supports(order.getPaymentMethodCode()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported payment method"));

        return paymentRepository.save(strategy.createInitialPayment(order, nextAttempt));
    }

    @Transactional
    public void markPaid(Long orderId) {
        paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(orderId).ifPresent(payment -> {
            payment.setStatus("paid");
            payment.setPaidAt(OffsetDateTime.now());
            payment.setGatewayMessage("Marked as paid during delivery confirmation");
            paymentRepository.save(payment);
        });
    }
}
