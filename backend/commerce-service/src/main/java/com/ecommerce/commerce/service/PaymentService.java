package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.domain.PaymentTransactionEntity;
import com.ecommerce.commerce.dto.PaymentStatusResponse;
import com.ecommerce.commerce.config.SepayProperties;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.commerce.repository.PaymentRepository;
import com.ecommerce.commerce.repository.PaymentTransactionRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OrderRepository orderRepository;
    private final List<PaymentMethodStrategy> paymentMethodStrategies;
    private final List<PaymentGateway> paymentGateways;
    private final InventoryService inventoryService;
    private final OutboxService outboxService;
    private final OrderEventPayloadFactory eventPayloadFactory;
    private final ObjectMapper objectMapper;
    private final SepayProperties sepayProperties;

    public PaymentService(
            PaymentRepository paymentRepository,
            PaymentTransactionRepository paymentTransactionRepository,
            OrderRepository orderRepository,
            List<PaymentMethodStrategy> paymentMethodStrategies,
            List<PaymentGateway> paymentGateways,
            InventoryService inventoryService,
            OutboxService outboxService,
            OrderEventPayloadFactory eventPayloadFactory,
            ObjectMapper objectMapper,
            SepayProperties sepayProperties
    ) {
        this.paymentRepository = paymentRepository;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.orderRepository = orderRepository;
        this.paymentMethodStrategies = paymentMethodStrategies;
        this.paymentGateways = paymentGateways;
        this.inventoryService = inventoryService;
        this.outboxService = outboxService;
        this.eventPayloadFactory = eventPayloadFactory;
        this.objectMapper = objectMapper;
        this.sepayProperties = sepayProperties;
    }

    @Transactional
    public PaymentEntity createInitialPayment(OrderEntity order, AuthenticatedUser principal) {
        int nextAttempt = paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(order.getId())
                .map(payment -> payment.getAttemptNo() + 1)
                .orElse(1);

        if (PaymentConstants.ONLINE_SEPAY_METHODS.contains(order.getPaymentMethodCode())) {
            return createSepayPayment(order, principal, nextAttempt);
        }

        PaymentMethodStrategy strategy = paymentMethodStrategies.stream()
                .filter(candidate -> candidate.supports(order.getPaymentMethodCode()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported payment method"));

        PaymentEntity payment = strategy.createInitialPayment(order, nextAttempt);
        payment.setInvoiceNumber(generateInvoiceNumber(order, nextAttempt));
        payment.setCustomerEmail(principal.email());
        return paymentRepository.save(payment);
    }

    @Transactional
    public void markPaid(Long orderId) {
        paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(orderId).ifPresent(payment -> {
            payment.setStatus(PaymentConstants.PAYMENT_PAID);
            payment.setPaidAt(OffsetDateTime.now());
            payment.setGatewayMessage("Marked as paid during delivery confirmation");
            paymentRepository.save(payment);
        });
    }

    @Transactional
    public void cancelOpenPayment(Long orderId, String message) {
        paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(orderId).ifPresent(payment -> {
            if (PaymentConstants.PAYMENT_PAID.equals(payment.getStatus())
                    || PaymentConstants.PAYMENT_CANCELLED.equals(payment.getStatus())) {
                return;
            }
            payment.setStatus(PaymentConstants.PAYMENT_CANCELLED);
            payment.setFailedAt(OffsetDateTime.now());
            payment.setGatewayMessage(message);
            paymentRepository.save(payment);
        });
    }

    @Transactional(readOnly = true)
    public PaymentStatusResponse getPaymentStatus(AuthenticatedUser principal, Long orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found"));
        ensureCanAccess(principal, order);
        PaymentEntity payment = paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(orderId).orElse(null);
        String paymentStatus = payment != null ? payment.getStatus() : order.getPaymentStatus();
        return new PaymentStatusResponse(
                order.getId(),
                order.getOrderNo(),
                order.getOrderStatus(),
                paymentStatus,
                order.getPaymentMethodCode(),
                order.getPaidAt(),
                paymentMessage(paymentStatus)
        );
    }

    @Transactional
    public SepayWebhookOutcome handleSepayWebhook(JsonNode payload, String authorization, String secretHeader, String configuredSecret) {
        if (!verifySepaySecret(authorization, secretHeader, configuredSecret)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Invalid SePay webhook secret");
        }

        SepayPayload parsed = parseSepayPayload(payload);
        log.info(
                "SePay webhook parsed reference={}, transactionId={}, amount={}, success={}",
                parsed.invoiceNumber(),
                parsed.providerTransactionId(),
                parsed.amount(),
                parsed.success()
        );
        if (parsed.invoiceNumber() == null || parsed.invoiceNumber().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Missing SePay invoice number");
        }

        PaymentEntity payment = findPaymentByReference(parsed.invoiceNumber());
        OrderEntity order = orderRepository.findById(payment.getOrderId())
                .orElseThrow(() -> new EntityNotFoundException("Order not found"));

        if (parsed.providerTransactionId() != null
                && paymentTransactionRepository.existsByProviderTransactionId(parsed.providerTransactionId())) {
            return new SepayWebhookOutcome(true, "Duplicate webhook ignored");
        }

        if (PaymentConstants.PAYMENT_PAID.equals(payment.getStatus())) {
            PaymentTransactionEntity ignoredTransaction = toTransaction(payment.getId(), parsed, payload);
            ignoredTransaction.setTransactionType("ignored_after_paid");
            ignoredTransaction.setTransactionStatus("IGNORED_AFTER_PAID");
            ignoredTransaction.setStatus("ignored_after_paid");
            paymentTransactionRepository.save(ignoredTransaction);
            log.warn(
                    "Ignoring SePay webhook for already paid order; paymentId={}, transactionId={}, amount={}",
                    payment.getId(),
                    parsed.providerTransactionId(),
                    parsed.amount()
            );
            return new SepayWebhookOutcome(true, "Payment already paid");
        }

        PaymentTransactionEntity transaction = toTransaction(payment.getId(), parsed, payload);

        if (parsed.success()) {
            if (payment.getAmount().compareTo(parsed.amount()) != 0) {
                payment.setStatus(PaymentConstants.PAYMENT_AMOUNT_MISMATCH);
                payment.setGatewayMessage("SePay amount mismatch");
                payment.setProviderTransactionId(parsed.providerTransactionId());
                payment.setRawResponse(payload);
                order.setPaymentStatus(PaymentConstants.PAYMENT_AMOUNT_MISMATCH);
                releaseOnlineReservationIfStillPending(order);
                paymentRepository.save(payment);
                orderRepository.save(order);
                paymentTransactionRepository.save(transaction);
                outboxService.publish("ORDER", order.getId().toString(), "PAYMENT_MISMATCH",
                        eventPayloadFactory.orderEvent("PAYMENT_MISMATCH", order, payment, null));
                return new SepayWebhookOutcome(true, "Amount mismatch recorded");
            }

            OffsetDateTime now = OffsetDateTime.now();
            payment.setStatus(PaymentConstants.PAYMENT_PAID);
            payment.setPaidAt(now);
            payment.setProviderTransactionId(parsed.providerTransactionId());
            payment.setGatewayResponseCode(parsed.notificationType());
            payment.setGatewayMessage("SePay payment confirmed");
            payment.setRawResponse(payload);
            order.setPaymentStatus(PaymentConstants.PAYMENT_PAID);
            order.setOrderStatus(PaymentConstants.ORDER_PAID);
            order.setPaidAt(now);
            paymentRepository.save(payment);
            orderRepository.save(order);
            paymentTransactionRepository.save(transaction);
            outboxService.publish("ORDER", order.getId().toString(), "ORDER_PAID",
                    eventPayloadFactory.orderEvent("ORDER_PAID", order, payment, null));
            return new SepayWebhookOutcome(true, "Payment confirmed");
        }

        payment.setStatus(PaymentConstants.PAYMENT_FAILED);
        payment.setFailedAt(OffsetDateTime.now());
        payment.setGatewayResponseCode(parsed.notificationType());
        payment.setGatewayMessage("SePay payment failed or cancelled");
        payment.setRawResponse(payload);
        order.setPaymentStatus(PaymentConstants.PAYMENT_FAILED);
        releaseOnlineReservationIfStillPending(order);
        paymentRepository.save(payment);
        orderRepository.save(order);
        paymentTransactionRepository.save(transaction);
        outboxService.publish("ORDER", order.getId().toString(), "PAYMENT_FAILED",
                eventPayloadFactory.orderEvent("PAYMENT_FAILED", order, payment, null));
        return new SepayWebhookOutcome(true, "Payment failure recorded");
    }

    @Transactional(readOnly = true)
    public String renderSepayCheckoutForm(Long paymentId) {
        PaymentEntity payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new EntityNotFoundException("Payment not found"));
        if (!PaymentConstants.METHOD_SEPAY_CHECKOUT.equalsIgnoreCase(payment.getMethod())
                && !PaymentConstants.METHOD_SEPAY_CARD.equalsIgnoreCase(payment.getMethod())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Payment is not a SePay checkout payment");
        }
        JsonNode rawRequest = payment.getRawRequest();
        if (rawRequest == null || !rawRequest.isObject()) {
            throw new BusinessException(HttpStatus.CONFLICT, "Checkout request is not initialized");
        }
        StringBuilder html = new StringBuilder();
        html.append("<!doctype html><html><head><meta charset=\"utf-8\"><title>SePay Checkout</title></head>");
        html.append("<body onload=\"document.forms[0].submit()\">");
        html.append("<form action=\"").append(escapeHtml(rawRequest.path("_checkoutEndpoint").asText())).append("\" method=\"POST\">");
        rawRequest.fields().forEachRemaining(entry -> {
            if (!entry.getKey().startsWith("_")) {
                html.append("<input type=\"hidden\" name=\"")
                        .append(escapeHtml(entry.getKey()))
                        .append("\" value=\"")
                        .append(escapeHtml(entry.getValue().asText()))
                        .append("\" />");
            }
        });
        html.append("<noscript><button type=\"submit\">Thanh toán</button></noscript>");
        html.append("</form></body></html>");
        return html.toString();
    }

    @Transactional
    public void expirePendingOnlinePayments() {
        OffsetDateTime now = OffsetDateTime.now();
        paymentRepository.findExpiredPendingOnlinePayments(PaymentConstants.ONLINE_SEPAY_METHODS, now)
                .forEach(payment -> {
                    OrderEntity order = orderRepository.findById(payment.getOrderId()).orElse(null);
                    if (order == null) {
                        return;
                    }
                    payment.setStatus(PaymentConstants.PAYMENT_EXPIRED);
                    payment.setFailedAt(now);
                    payment.setGatewayMessage("Payment expired before confirmation");
                    if (PaymentConstants.ORDER_PENDING_PAYMENT.equals(order.getOrderStatus())) {
                        releaseOnlineReservationIfStillPending(order);
                        order.setOrderStatus(PaymentConstants.ORDER_PAYMENT_EXPIRED);
                        order.setPaymentStatus(PaymentConstants.PAYMENT_EXPIRED);
                    }
                    paymentRepository.save(payment);
                    orderRepository.save(order);
                    outboxService.publish("ORDER", order.getId().toString(), "PAYMENT_EXPIRED",
                            eventPayloadFactory.orderEvent("PAYMENT_EXPIRED", order, payment, null));
                });
    }

    private PaymentEntity createSepayPayment(OrderEntity order, AuthenticatedUser principal, int nextAttempt) {
        PaymentGateway gateway = paymentGateways.stream()
                .filter(candidate -> candidate.supports(order.getPaymentMethodCode()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported SePay payment method"));
        String invoiceNumber = generateInvoiceNumber(order, nextAttempt);
        OffsetDateTime expiredAt = OffsetDateTime.now().plusMinutes(sepayProperties.getPaymentExpireMinutes());
        CreatePaymentCommand command = new CreatePaymentCommand(
                order.getId(),
                order.getOrderNo(),
                order.getUserId(),
                principal.email(),
                order.getReceiverName(),
                order.getPaymentMethodCode(),
                invoiceNumber,
                order.getGrandTotal(),
                "VND",
                expiredAt
        );
        CreatePaymentResult result = gateway.createPayment(command);

        PaymentEntity payment = new PaymentEntity();
        payment.setOrderId(order.getId());
        payment.setAttemptNo(nextAttempt);
        payment.setProvider(result.provider());
        payment.setMethod(order.getPaymentMethodCode());
        payment.setStatus(PaymentConstants.PAYMENT_PENDING);
        payment.setAmount(order.getGrandTotal());
        payment.setCurrency("VND");
        payment.setProviderOrderId(result.providerOrderId());
        payment.setInvoiceNumber(invoiceNumber);
        payment.setCheckoutUrl(result.checkoutUrl());
        payment.setQrCodeUrl(result.qrCodeUrl());
        payment.setQrImageBase64(result.qrImageBase64());
        payment.setQrContent(result.qrContent());
        payment.setBankDeepLink(result.bankDeepLink());
        payment.setBankName(result.bankName());
        payment.setBankCode(result.bankCode());
        payment.setBankBin(result.bankBin());
        payment.setBankAccountNumber(result.bankAccountNumber());
        payment.setAccountName(result.accountName());
        payment.setTransferContent(result.transferContent());
        payment.setCustomerEmail(principal.email());
        payment.setExpiredAt(command.expiredAt());
        payment.setRawRequest(result.rawRequest());
        payment.setRawResponse(result.rawResponse());
        payment.setGatewayMessage(result.gatewayMessage());

        PaymentEntity saved = paymentRepository.save(payment);
        if (PaymentConstants.METHOD_SEPAY_CHECKOUT.equalsIgnoreCase(saved.getMethod())
                || PaymentConstants.METHOD_SEPAY_CARD.equalsIgnoreCase(saved.getMethod())) {
            saved.setCheckoutUrl(((SepayPaymentGateway) gateway).checkoutUrl(saved.getId()));
            saved.setRawRequest(addCheckoutEndpoint(saved.getRawRequest(), ((SepayPaymentGateway) gateway).checkoutEndpoint()));
            saved = paymentRepository.save(saved);
        }
        outboxService.publish("ORDER", order.getId().toString(), "ORDER_PAYMENT_PENDING",
                eventPayloadFactory.orderEvent("ORDER_PAYMENT_PENDING", order, saved, principal));
        return saved;
    }

    private JsonNode addCheckoutEndpoint(JsonNode rawRequest, String checkoutEndpoint) {
        Map<String, Object> fields = objectMapper.convertValue(rawRequest, Map.class);
        fields.put("_checkoutEndpoint", checkoutEndpoint);
        return objectMapper.valueToTree(fields);
    }

    private String generateInvoiceNumber(OrderEntity order, int attempt) {
        String orderReference = normalizePaymentReference(order.getOrderNo());
        if (orderReference.isBlank()) {
            orderReference = "ORDER" + order.getId();
        }
        return orderReference + "P" + attempt;
    }

    private PaymentEntity findPaymentByReference(String reference) {
        String normalizedReference = normalizePaymentReference(reference);
        if (normalizedReference.isBlank()) {
            return paymentRepository.findByInvoiceNumber(reference)
                    .orElseThrow(() -> new EntityNotFoundException("Payment not found"));
        }
        return paymentRepository.findTopByPaymentReference(reference, normalizedReference)
                .orElseThrow(() -> new EntityNotFoundException("Payment not found"));
    }

    private String normalizePaymentReference(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private void ensureCanAccess(AuthenticatedUser principal, OrderEntity order) {
        if (principal.roles().contains("ADMIN")) {
            return;
        }
        UUID requester = UUID.fromString(principal.userId());
        if (!requester.equals(order.getUserId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You do not have access to this order");
        }
    }

    private void releaseOnlineReservationIfStillPending(OrderEntity order) {
        if (!PaymentConstants.ONLINE_SEPAY_METHODS.contains(order.getPaymentMethodCode())) {
            return;
        }
        if (!PaymentConstants.ORDER_PENDING_PAYMENT.equals(order.getOrderStatus())) {
            return;
        }
        inventoryService.releaseReservations(order.getId());
    }

    private boolean verifySepaySecret(String authorization, String secretHeader, String configuredSecret) {
        if (configuredSecret == null || configuredSecret.isBlank()) {
            return false;
        }
        if (secretHeader != null && secretHeader.equals(configuredSecret)) {
            return true;
        }
        if (authorization == null || authorization.isBlank()) {
            return false;
        }
        String normalizedAuthorization = authorization.trim();
        return normalizedAuthorization.equals(configuredSecret)
                || normalizedAuthorization.equalsIgnoreCase("Apikey " + configuredSecret)
                || normalizedAuthorization.equalsIgnoreCase("Bearer " + configuredSecret);
    }

    private SepayPayload parseSepayPayload(JsonNode payload) {
        JsonNode orderNode = payload.path("order");
        JsonNode transactionNode = payload.path("transaction");
        String notificationType = firstNotBlank(
                text(payload, "notification_type", ""),
                text(payload, "notificationType", ""),
                findText(payload, "notification_type", "notificationType")
        );
        String invoiceNumber = firstNotBlank(
                text(orderNode, "order_invoice_number", ""),
                text(orderNode, "invoice_number", ""),
                text(payload, "code", ""),
                text(payload, "payment_code", ""),
                text(payload, "invoiceNumber", ""),
                text(payload, "invoice_number", ""),
                text(payload, "transferContent", ""),
                text(payload, "content", ""),
                text(payload, "description", ""),
                text(transactionNode, "transaction_content", ""),
                text(transactionNode, "transaction_description", ""),
                findText(payload,
                        "order_invoice_number",
                        "invoice_number",
                        "invoiceNumber",
                        "payment_code",
                        "transferContent",
                        "content",
                        "description",
                        "transaction_content",
                        "transaction_description"
                )
        );
        String transactionId = blankToNull(firstNotBlank(
                text(transactionNode, "transaction_id", ""),
                text(payload, "transactionId", ""),
                text(payload, "transaction_id", ""),
                text(payload, "referenceCode", ""),
                text(payload, "reference_code", ""),
                text(payload, "id", ""),
                findText(payload, "transaction_id", "transactionId", "referenceCode", "reference_code", "id")
        ));
        BigDecimal amount = firstDecimal(
                decimal(transactionNode, "transaction_amount", null),
                decimal(transactionNode, "amount", null),
                decimal(orderNode, "order_amount", null),
                decimal(payload, "transferAmount", null),
                decimal(payload, "transfer_amount", null),
                decimal(payload, "amount", null),
                decimal(payload, "orderAmount", null),
                findDecimal(payload, "transaction_amount", "transferAmount", "transfer_amount", "order_amount", "orderAmount", "amount"),
                BigDecimal.ZERO
        );
        String currency = firstNotBlank(
                text(transactionNode, "transaction_currency", ""),
                text(orderNode, "order_currency", ""),
                text(payload, "currency", ""),
                findText(payload, "transaction_currency", "order_currency", "currency"),
                "VND"
        );
        String status = firstNotBlank(
                text(transactionNode, "transaction_status", ""),
                text(payload, "transactionStatus", ""),
                text(payload, "transaction_status", ""),
                text(payload, "status", ""),
                findText(payload, "transaction_status", "transactionStatus", "status")
        );
        String transferType = firstNotBlank(
                text(payload, "transferType", ""),
                text(payload, "transfer_type", ""),
                findText(payload, "transferType", "transfer_type")
        );
        String orderStatus = firstNotBlank(
                text(orderNode, "order_status", ""),
                text(payload, "orderStatus", ""),
                text(payload, "order_status", ""),
                findText(payload, "order_status", "orderStatus")
        );
        boolean success = "ORDER_PAID".equalsIgnoreCase(notificationType)
                || "PAYMENT_SUCCESS".equalsIgnoreCase(notificationType)
                || "APPROVED".equalsIgnoreCase(status)
                || "CAPTURED".equalsIgnoreCase(orderStatus)
                || "in".equalsIgnoreCase(transferType)
                || "credit".equalsIgnoreCase(transferType);
        String transactionType = "webhook_update";
        String transactionStatus = status.isBlank() ? (success ? "APPROVED" : "FAILED") : status;
        return new SepayPayload(invoiceNumber, transactionId, amount, currency, notificationType, transactionType, transactionStatus, success);
    }

    private String paymentMessage(String paymentStatus) {
        return switch (paymentStatus) {
            case PaymentConstants.PAYMENT_PAID -> "Thanh toán thành công";
            case PaymentConstants.PAYMENT_FAILED -> "Thanh toán chưa hoàn tất";
            case PaymentConstants.PAYMENT_EXPIRED -> "Thanh toán đã hết hạn";
            case PaymentConstants.PAYMENT_AMOUNT_MISMATCH -> "Số tiền thanh toán không khớp";
            default -> "Đang chờ xác nhận thanh toán";
        };
    }

    private PaymentTransactionEntity toTransaction(Long paymentId, SepayPayload parsed, JsonNode payload) {
        PaymentTransactionEntity transaction = new PaymentTransactionEntity();
        transaction.setPaymentId(paymentId);
        transaction.setProviderTransactionId(parsed.providerTransactionId());
        transaction.setTransactionType(parsed.transactionType());
        transaction.setTransactionStatus(parsed.transactionStatus());
        transaction.setStatus(parsed.transactionStatus().toLowerCase(Locale.ROOT));
        transaction.setAmount(parsed.amount());
        transaction.setCurrency(parsed.currency());
        transaction.setExternalRef(parsed.providerTransactionId());
        transaction.setRawPayload(payload);
        return transaction;
    }

    private String text(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? fallback : value.asText();
    }

    private BigDecimal decimal(JsonNode node, String field, BigDecimal fallback) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            return fallback;
        }
        String normalized = value.asText().trim().replaceAll("[^0-9,.-]", "").replace(",", "");
        if (normalized.isBlank() || "-".equals(normalized) || ".".equals(normalized)) {
            return fallback;
        }
        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private BigDecimal firstDecimal(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null) {
                return value;
            }
        }
        return BigDecimal.ZERO;
    }

    private String findText(JsonNode node, String... fields) {
        if (node == null || node.isNull()) {
            return "";
        }
        for (String field : fields) {
            JsonNode value = node.get(field);
            if (value != null && !value.isNull() && !value.asText().isBlank()) {
                return value.asText();
            }
        }
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> iterator = node.fields();
            while (iterator.hasNext()) {
                String nested = findText(iterator.next().getValue(), fields);
                if (!nested.isBlank()) {
                    return nested;
                }
            }
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                String nested = findText(child, fields);
                if (!nested.isBlank()) {
                    return nested;
                }
            }
        }
        return "";
    }

    private BigDecimal findDecimal(JsonNode node, String... fields) {
        if (node == null || node.isNull()) {
            return null;
        }
        for (String field : fields) {
            BigDecimal value = decimal(node, field, null);
            if (value != null) {
                return value;
            }
        }
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> iterator = node.fields();
            while (iterator.hasNext()) {
                BigDecimal nested = findDecimal(iterator.next().getValue(), fields);
                if (nested != null) {
                    return nested;
                }
            }
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                BigDecimal nested = findDecimal(child, fields);
                if (nested != null) {
                    return nested;
                }
            }
        }
        return null;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    public record SepayWebhookOutcome(boolean success, String message) {
    }

    private record SepayPayload(
            String invoiceNumber,
            String providerTransactionId,
            BigDecimal amount,
            String currency,
            String notificationType,
            String transactionType,
            String transactionStatus,
            boolean success
    ) {
    }
}
