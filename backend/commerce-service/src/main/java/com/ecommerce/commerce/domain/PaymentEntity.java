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

    @Column(name = "gateway_response_code")
    private String gatewayResponseCode;

    @Column(name = "gateway_message")
    private String gatewayMessage;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Column(name = "failed_at")
    private OffsetDateTime failedAt;
}
