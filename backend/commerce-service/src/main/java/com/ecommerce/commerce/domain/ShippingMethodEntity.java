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

@Getter
@Setter
@Entity
@Table(name = "shipping_methods")
public class ShippingMethodEntity extends VersionedAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    private String description;

    @Column(name = "estimated_min_days", nullable = false)
    private Integer estimatedMinDays;

    @Column(name = "estimated_max_days", nullable = false)
    private Integer estimatedMaxDays;

    @Column(nullable = false)
    private BigDecimal fee;

    @Column(nullable = false)
    private boolean active;
}
