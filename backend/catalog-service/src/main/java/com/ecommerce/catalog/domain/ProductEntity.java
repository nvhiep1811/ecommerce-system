package com.ecommerce.catalog.domain;

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
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "products")
public class ProductEntity extends VersionedAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "brand_id")
    private Long brandId;

    @Column(name = "seller_id")
    private UUID sellerId;

    @Column(name = "product_type", nullable = false)
    private String productType;

    private String sku;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug;

    @Column(name = "short_description")
    private String shortDescription;

    private String description;

    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @Column(name = "base_price")
    private BigDecimal basePrice;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private boolean published;

    @Column(name = "published_at")
    private OffsetDateTime publishedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "rating_avg", nullable = false)
    private BigDecimal ratingAvg;

    @Column(name = "review_count", nullable = false)
    private Integer reviewCount;

    @Column(name = "embedding", columnDefinition = "vector(3072)", insertable = false, updatable = false)
    private String embedding;
}
