package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.SepayProperties;
import com.ecommerce.commerce.config.VietQrProperties;
import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.commerce.repository.PaymentRepository;
import com.ecommerce.commerce.repository.PaymentTransactionRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentServiceTest {

    private final PaymentRepository paymentRepository = mock(PaymentRepository.class);
    private final PaymentTransactionRepository paymentTransactionRepository = mock(PaymentTransactionRepository.class);
    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final InventoryService inventoryService = mock(InventoryService.class);
    private final OutboxService outboxService = mock(OutboxService.class);
    private final OrderEventPayloadFactory eventPayloadFactory = mock(OrderEventPayloadFactory.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(
                paymentRepository,
                paymentTransactionRepository,
                orderRepository,
                List.of(),
                List.of(),
                inventoryService,
                outboxService,
                eventPayloadFactory,
                objectMapper,
                new SepayProperties()
        );
    }

    @Test
    void handleSepayWebhookShouldMarkPaymentSuccessAndOrderPaid() throws Exception {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        JsonNode payload = successPayload("INV-1", "tx-1", "50000");
        stubPaymentReference("INV-1", payment);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.existsByProviderTransactionId("tx-1")).thenReturn(false);
        when(eventPayloadFactory.orderEvent(eq("ORDER_PAID"), eq(order), eq(payment), isNull()))
                .thenReturn(Map.of("eventType", "ORDER_PAID"));

        PaymentService.SepayWebhookOutcome outcome = paymentService.handleSepayWebhook(payload, null, "secret", "secret");

        assertEquals("Payment confirmed", outcome.message());
        assertEquals(PaymentConstants.PAYMENT_PAID, payment.getStatus());
        assertEquals(PaymentConstants.ORDER_PAID, order.getOrderStatus());
        assertEquals(PaymentConstants.PAYMENT_PAID, order.getPaymentStatus());
        assertNotNull(payment.getPaidAt());
        assertNotNull(order.getPaidAt());
        verify(paymentRepository).save(payment);
        verify(orderRepository).save(order);
        verify(paymentTransactionRepository).save(any());
        verify(outboxService).publish(eq("ORDER"), eq("99"), eq("ORDER_PAID"), any());
        verify(inventoryService, never()).releaseReservations(any());
    }

    @Test
    void handleSepayWebhookShouldBeIdempotentForDuplicateTransaction() throws Exception {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        JsonNode payload = successPayload("INV-1", "tx-1", "50000");
        stubPaymentReference("INV-1", payment);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.existsByProviderTransactionId("tx-1")).thenReturn(true);

        PaymentService.SepayWebhookOutcome outcome = paymentService.handleSepayWebhook(payload, null, "secret", "secret");

        assertEquals("Duplicate webhook ignored", outcome.message());
        verify(paymentRepository, never()).save(any());
        verify(orderRepository, never()).save(any());
        verify(outboxService, never()).publish(any(), any(), any(), any());
    }

    @Test
    void handleSepayWebhookShouldSetAmountMismatchWhenAmountDiffers() throws Exception {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        JsonNode payload = successPayload("INV-1", "tx-1", "49000");
        stubPaymentReference("INV-1", payment);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.existsByProviderTransactionId("tx-1")).thenReturn(false);
        when(eventPayloadFactory.orderEvent(eq("PAYMENT_MISMATCH"), eq(order), eq(payment), isNull()))
                .thenReturn(Map.of("eventType", "PAYMENT_MISMATCH"));

        PaymentService.SepayWebhookOutcome outcome = paymentService.handleSepayWebhook(payload, null, "secret", "secret");

        assertEquals("Amount mismatch recorded", outcome.message());
        assertEquals(PaymentConstants.PAYMENT_AMOUNT_MISMATCH, payment.getStatus());
        assertEquals(PaymentConstants.PAYMENT_AMOUNT_MISMATCH, order.getPaymentStatus());
        verify(paymentRepository).save(payment);
        verify(orderRepository).save(order);
        verify(inventoryService).releaseReservations(99L);
        verify(outboxService).publish(eq("ORDER"), eq("99"), eq("PAYMENT_MISMATCH"), any());
    }

    @Test
    void handleSepayWebhookShouldReleaseReservationWhenPaymentFails() throws Exception {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        JsonNode payload = failedPayload("INV-1", "tx-1", "50000");
        stubPaymentReference("INV-1", payment);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.existsByProviderTransactionId("tx-1")).thenReturn(false);
        when(eventPayloadFactory.orderEvent(eq("PAYMENT_FAILED"), eq(order), eq(payment), isNull()))
                .thenReturn(Map.of("eventType", "PAYMENT_FAILED"));

        PaymentService.SepayWebhookOutcome outcome = paymentService.handleSepayWebhook(payload, null, "secret", "secret");

        assertEquals("Payment failure recorded", outcome.message());
        assertEquals(PaymentConstants.PAYMENT_FAILED, payment.getStatus());
        assertEquals(PaymentConstants.PAYMENT_FAILED, order.getPaymentStatus());
        assertEquals(PaymentConstants.ORDER_PENDING_PAYMENT, order.getOrderStatus());
        verify(inventoryService).releaseReservations(99L);
        verify(outboxService).publish(eq("ORDER"), eq("99"), eq("PAYMENT_FAILED"), any());
    }

    @Test
    void expiredQrPaymentShouldSetPaymentExpiredAndOrderPaymentExpired() {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        when(paymentRepository.findExpiredPendingOnlinePayments(eq(PaymentConstants.ONLINE_SEPAY_METHODS), any()))
                .thenReturn(List.of(payment));
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(eventPayloadFactory.orderEvent(eq("PAYMENT_EXPIRED"), eq(order), eq(payment), isNull()))
                .thenReturn(Map.of("eventType", "PAYMENT_EXPIRED"));

        paymentService.expirePendingOnlinePayments();

        assertEquals(PaymentConstants.PAYMENT_EXPIRED, payment.getStatus());
        assertEquals(PaymentConstants.ORDER_PAYMENT_EXPIRED, order.getOrderStatus());
        assertEquals(PaymentConstants.PAYMENT_EXPIRED, order.getPaymentStatus());
        verify(inventoryService).releaseReservations(99L);
        verify(outboxService).publish(eq("ORDER"), eq("99"), eq("PAYMENT_EXPIRED"), any());
    }

    @Test
    void openingBankDeepLinkShouldNotMarkPaymentSuccess() {
        paymentService = paymentServiceWithQrGateway(true);
        OrderEntity order = order();
        AuthenticatedUser principal = principal(order.getUserId());
        stubCreatePaymentSave(order, principal);

        PaymentEntity payment = paymentService.createInitialPayment(order, principal);

        assertNotNull(payment.getBankDeepLink());
        assertEquals(PaymentConstants.PAYMENT_PENDING, payment.getStatus());
        assertEquals(PaymentConstants.ORDER_PENDING_PAYMENT, order.getOrderStatus());
        assertEquals(PaymentConstants.PAYMENT_PENDING, order.getPaymentStatus());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void downloadingQrShouldNotMarkPaymentSuccess() {
        paymentService = paymentServiceWithQrGateway(false);
        OrderEntity order = order();
        AuthenticatedUser principal = principal(order.getUserId());
        stubCreatePaymentSave(order, principal);

        PaymentEntity payment = paymentService.createInitialPayment(order, principal);

        assertNotNull(payment.getQrCodeUrl());
        assertEquals(PaymentConstants.PAYMENT_PENDING, payment.getStatus());
        assertEquals(PaymentConstants.ORDER_PENDING_PAYMENT, order.getOrderStatus());
        assertEquals(PaymentConstants.PAYMENT_PENDING, order.getPaymentStatus());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void createSepayQrPaymentShouldUseBankSafeTransferContent() {
        paymentService = paymentServiceWithQrGateway(false);
        OrderEntity order = order();
        AuthenticatedUser principal = principal(order.getUserId());
        stubCreatePaymentSave(order, principal);

        PaymentEntity payment = paymentService.createInitialPayment(order, principal);

        assertEquals("ORD99P1", payment.getInvoiceNumber());
        assertEquals("ORD99P1", payment.getTransferContent());
        assertTrue(payment.getQrCodeUrl().contains("addInfo=ORD99P1"));
    }

    @Test
    void sepayWebhookShouldBeOnlySourceToMarkPaymentSuccess() throws Exception {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        JsonNode payload = successPayload("INV-1", "tx-only-source", "50000");
        stubPaymentReference("INV-1", payment);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.existsByProviderTransactionId("tx-only-source")).thenReturn(false);
        when(eventPayloadFactory.orderEvent(eq("ORDER_PAID"), eq(order), eq(payment), isNull()))
                .thenReturn(Map.of("eventType", "ORDER_PAID"));

        paymentService.handleSepayWebhook(payload, null, "secret", "secret");

        assertEquals(PaymentConstants.PAYMENT_PAID, payment.getStatus());
        assertEquals(PaymentConstants.ORDER_PAID, order.getOrderStatus());
        verify(outboxService).publish(eq("ORDER"), eq("99"), eq("ORDER_PAID"), any());
    }

    @Test
    void handleSepayWebhookShouldMatchSanitizedTransferContent() throws Exception {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        payment.setInvoiceNumber("ORD-99-P1");
        payment.setTransferContent("ORD-99-P1");
        JsonNode payload = successPayload("ORD99P1", "tx-sanitized", "50000");
        stubPaymentReference("ORD99P1", payment);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.existsByProviderTransactionId("tx-sanitized")).thenReturn(false);
        when(eventPayloadFactory.orderEvent(eq("ORDER_PAID"), eq(order), eq(payment), isNull()))
                .thenReturn(Map.of("eventType", "ORDER_PAID"));

        PaymentService.SepayWebhookOutcome outcome = paymentService.handleSepayWebhook(payload, null, "secret", "secret");

        assertEquals("Payment confirmed", outcome.message());
        assertEquals(PaymentConstants.PAYMENT_PAID, payment.getStatus());
        assertEquals(PaymentConstants.ORDER_PAID, order.getOrderStatus());
    }

    @Test
    void handleSepayWebhookShouldReadReferenceFromBankTransferContent() throws Exception {
        OrderEntity order = order();
        PaymentEntity payment = payment(order.getId(), new BigDecimal("50000.00"));
        payment.setInvoiceNumber("ORD99P1");
        payment.setTransferContent("ORD99P1");
        JsonNode payload = bankTransferPayload("MBBANK ORD99P1", "tx-bank-content", "50000");
        stubPaymentReference("MBBANK ORD99P1", payment);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.existsByProviderTransactionId("tx-bank-content")).thenReturn(false);
        when(eventPayloadFactory.orderEvent(eq("ORDER_PAID"), eq(order), eq(payment), isNull()))
                .thenReturn(Map.of("eventType", "ORDER_PAID"));

        PaymentService.SepayWebhookOutcome outcome = paymentService.handleSepayWebhook(payload, null, "secret", "secret");

        assertEquals("Payment confirmed", outcome.message());
        assertEquals(PaymentConstants.PAYMENT_PAID, payment.getStatus());
        assertEquals(PaymentConstants.ORDER_PAID, order.getOrderStatus());
    }

    private OrderEntity order() {
        OrderEntity order = new OrderEntity();
        order.setId(99L);
        order.setOrderNo("ORD-99");
        order.setUserId(UUID.randomUUID());
        order.setOrderStatus(PaymentConstants.ORDER_PENDING_PAYMENT);
        order.setPaymentStatus(PaymentConstants.PAYMENT_PENDING);
        order.setPaymentMethodCode(PaymentConstants.METHOD_SEPAY_QR);
        order.setGrandTotal(new BigDecimal("50000.00"));
        order.setReceiverName("Nguyen Van A");
        return order;
    }

    private PaymentEntity payment(Long orderId, BigDecimal amount) {
        PaymentEntity payment = new PaymentEntity();
        payment.setId(10L);
        payment.setOrderId(orderId);
        payment.setProvider(PaymentConstants.PROVIDER_SEPAY);
        payment.setMethod(PaymentConstants.METHOD_SEPAY_QR);
        payment.setStatus(PaymentConstants.PAYMENT_PENDING);
        payment.setInvoiceNumber("INV-1");
        payment.setAmount(amount);
        payment.setCurrency("VND");
        payment.setCustomerEmail("buyer@example.com");
        return payment;
    }

    private PaymentService paymentServiceWithQrGateway(boolean deeplinkEnabled) {
        SepayProperties sepayProperties = new SepayProperties();
        sepayProperties.setBankName("Ngân hàng TMCP Quân đội");
        sepayProperties.setBankAccountNumber("29120044002192");
        sepayProperties.setAccountName("Nguyen Vo Hiep");
        VietQrProperties vietQrProperties = new VietQrProperties();
        vietQrProperties.setEnabled(true);
        vietQrProperties.setBankBin("970422");
        vietQrProperties.setBankCode("mb");
        vietQrProperties.setAccountNo("29120044002192");
        vietQrProperties.setAccountName("NGUYEN VO HIEP");
        vietQrProperties.setDeeplinkEnabled(deeplinkEnabled);
        vietQrProperties.setDeeplinkAppCode(deeplinkEnabled ? "mb" : "");

        return new PaymentService(
                paymentRepository,
                paymentTransactionRepository,
                orderRepository,
                List.of(),
                List.of(new SepayPaymentGateway(sepayProperties, new VietQrService(vietQrProperties), objectMapper)),
                inventoryService,
                outboxService,
                eventPayloadFactory,
                objectMapper,
                sepayProperties
        );
    }

    private void stubCreatePaymentSave(OrderEntity order, AuthenticatedUser principal) {
        when(paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(order.getId())).thenReturn(Optional.empty());
        when(paymentRepository.save(any(PaymentEntity.class))).thenAnswer(invocation -> {
            PaymentEntity payment = invocation.getArgument(0);
            payment.setId(10L);
            return payment;
        });
        when(eventPayloadFactory.orderEvent(eq("ORDER_PAYMENT_PENDING"), eq(order), any(PaymentEntity.class), eq(principal)))
                .thenReturn(Map.of("eventType", "ORDER_PAYMENT_PENDING"));
    }

    private AuthenticatedUser principal(UUID userId) {
        return new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
    }

    private void stubPaymentReference(String reference, PaymentEntity payment) {
        when(paymentRepository.findTopByPaymentReference(eq(reference), eq(normalizeReference(reference))))
                .thenReturn(Optional.of(payment));
    }

    private String normalizeReference(String value) {
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private JsonNode successPayload(String invoiceNumber, String transactionId, String amount) throws Exception {
        return objectMapper.readTree("""
                {
                  "notification_type": "PAYMENT_SUCCESS",
                  "order": {
                    "order_invoice_number": "%s",
                    "order_status": "CAPTURED",
                    "order_currency": "VND"
                  },
                  "transaction": {
                    "transaction_id": "%s",
                    "transaction_type": "PAYMENT",
                    "transaction_status": "APPROVED",
                    "transaction_amount": "%s",
                    "transaction_currency": "VND"
                  }
                }
                """.formatted(invoiceNumber, transactionId, amount));
    }

    private JsonNode failedPayload(String invoiceNumber, String transactionId, String amount) throws Exception {
        return objectMapper.readTree("""
                {
                  "notification_type": "PAYMENT_FAILED",
                  "order": {
                    "order_invoice_number": "%s",
                    "order_status": "FAILED",
                    "order_currency": "VND"
                  },
                  "transaction": {
                    "transaction_id": "%s",
                    "transaction_type": "PAYMENT",
                    "transaction_status": "DECLINED",
                    "transaction_amount": "%s",
                    "transaction_currency": "VND"
                  }
                }
                """.formatted(invoiceNumber, transactionId, amount));
    }

    private JsonNode bankTransferPayload(String content, String transactionId, String amount) throws Exception {
        return objectMapper.readTree("""
                {
                  "id": "%s",
                  "content": "%s",
                  "transferType": "in",
                  "transferAmount": "%s"
                }
                """.formatted(transactionId, content, amount));
    }
}
