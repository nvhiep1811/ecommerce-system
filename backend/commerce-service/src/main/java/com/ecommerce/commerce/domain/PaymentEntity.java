package com.ecommerce.commerce.domain;

import com.ecommerce.shared.domain.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import com.fasterxml.jackson.databind.JsonNode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "payments")
public class PaymentEntity extends VersionedAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "attempt_no", nullable = false)
    private Integer attemptNo;

    @Column(nullable = false)
    private String provider;

    @Column(nullable = false)
    private String method;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String currency;

    @Column(name = "provider_transaction_id")
    private String providerTransactionId;

    @Column(name = "provider_order_id")
    private String providerOrderId;

    @Column(name = "invoice_number")
    private String invoiceNumber;

    @Column(name = "gateway_response_code")
    private String gatewayResponseCode;

    @Column(name = "gateway_message")
    private String gatewayMessage;

    @Column(name = "checkout_url")
    private String checkoutUrl;

    @Column(name = "qr_code_url")
    private String qrCodeUrl;

    @Column(name = "qr_image_base64")
    private String qrImageBase64;

    @Column(name = "qr_content")
    private String qrContent;

    @Column(name = "bank_deep_link")
    private String bankDeepLink;

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "bank_code")
    private String bankCode;

    @Column(name = "bank_bin")
    private String bankBin;

    @Column(name = "bank_account_number")
    private String bankAccountNumber;

    @Column(name = "account_name")
    private String accountName;

    @Column(name = "transfer_content")
    private String transferContent;

    @Column(name = "customer_email")
    private String customerEmail;

    @Column(name = "expired_at")
    private OffsetDateTime expiredAt;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "failed_at")
    private OffsetDateTime failedAt;

    @Column(name = "raw_request", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode rawRequest;

    @Column(name = "raw_response", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode rawResponse;
}
