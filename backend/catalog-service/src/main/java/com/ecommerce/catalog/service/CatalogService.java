package com.ecommerce.catalog.service;

import com.ecommerce.catalog.client.InventorySyncClient;
import com.ecommerce.catalog.domain.CategoryEntity;
import com.ecommerce.catalog.domain.CouponEntity;
import com.ecommerce.catalog.domain.CouponUsageEntity;
import com.ecommerce.catalog.domain.InventoryItemView;
import com.ecommerce.catalog.domain.ProductEntity;
import com.ecommerce.catalog.dto.CategoryResponse;
import com.ecommerce.catalog.dto.CouponConsumeRequest;
import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.CouponValidationRequest;
import com.ecommerce.catalog.dto.CouponValidationResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.dto.ProductSnapshotResponse;
import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.catalog.repository.CategoryRepository;
import com.ecommerce.catalog.repository.CouponRepository;
import com.ecommerce.catalog.repository.CouponUsageRepository;
import com.ecommerce.catalog.repository.InventoryItemViewRepository;
import com.ecommerce.catalog.repository.ProductRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CatalogService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final CouponRepository couponRepository;
    private final CouponUsageRepository couponUsageRepository;
    private final InventoryItemViewRepository inventoryItemViewRepository;
    private final InventorySyncClient inventorySyncClient;
    private final OutboxService outboxService;

    public CatalogService(
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            CouponRepository couponRepository,
            CouponUsageRepository couponUsageRepository,
            InventoryItemViewRepository inventoryItemViewRepository,
            InventorySyncClient inventorySyncClient,
            OutboxService outboxService
    ) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.couponRepository = couponRepository;
        this.couponUsageRepository = couponUsageRepository;
        this.inventoryItemViewRepository = inventoryItemViewRepository;
        this.inventorySyncClient = inventorySyncClient;
        this.outboxService = outboxService;
    }

    public List<CategoryResponse> getCategories(Long parentId) {
        List<CategoryEntity> categories = parentId == null
                ? categoryRepository.findByParentIdIsNullAndActiveTrueOrderByNameAsc()
                : categoryRepository.findByParentIdAndActiveTrueOrderByNameAsc(parentId);

        return categories.stream()
                .map(category -> new CategoryResponse(category.getId(), category.getParentId(), category.getName()))
                .toList();
    }

    public List<ProductResponse> getProducts(Long categoryId, UUID sellerId, String search, boolean featured) {
        List<ProductEntity> products;
        if (sellerId != null) {
            products = productRepository.findBySellerIdAndDeletedAtIsNullOrderByCreatedAtDesc(sellerId);
        } else if (search != null && !search.isBlank()) {
            products = productRepository.findByNameContainingIgnoreCaseAndDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc(search.trim());
        } else if (featured) {
            products = productRepository.findTop10ByDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByRatingAvgDescCreatedAtDesc();
        } else if (categoryId != null) {
            List<Long> categoryIds = categoryRepository.findByParentIdAndActiveTrueOrderByNameAsc(categoryId)
                    .stream()
                    .map(CategoryEntity::getId)
                    .collect(Collectors.toList());
            categoryIds.add(categoryId);
            products = productRepository.findByCategoryIdInAndDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc(categoryIds);
        } else {
            products = productRepository.findByDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc();
        }

        Map<Long, Integer> stockMap = loadStockMap(products.stream().map(ProductEntity::getId).toList());
        return products.stream().map(product -> toProductResponse(product, stockMap.getOrDefault(product.getId(), 0))).toList();
    }

    public ProductResponse getProduct(Long id) {
        ProductEntity product = productRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        int stock = inventoryItemViewRepository.findByProductIdAndVariantIdIsNull(id)
                .map(InventoryItemView::getAvailableQty)
                .orElse(0);
        return toProductResponse(product, stock);
    }

    @PreAuthorize("hasRole('SELLER')")
    public ProductResponse createProduct(AuthenticatedUser principal, ProductUpsertRequest request) {
        // Save và commit
        ProductEntity saved = saveProduct(principal, request);

        // Gọi inventory-service SAU KHI đã commit
        inventorySyncClient.upsertStock(saved.getId(), request.stock());

        return toProductResponse(saved, request.stock());
    }

    @Transactional  // Bao quanh phần DB của catalog-service
    protected ProductEntity saveProduct(AuthenticatedUser principal, ProductUpsertRequest request) {
        ProductEntity product = new ProductEntity();
        product.setSellerId(UUID.fromString(principal.userId()));
        product.setCategoryId(request.subCategoryId());
        product.setProductType("simple");
        product.setSku("SKU-" + System.currentTimeMillis());
        product.setName(request.name().trim());
        product.setSlug(toSlug(request.name()));
        product.setShortDescription(request.description().trim());
        product.setDescription(request.description().trim());
        product.setThumbnailUrl(request.thumbnail());
        product.setBasePrice(request.price());
        product.setActive(true);
        product.setPublished(true);
        product.setPublishedAt(OffsetDateTime.now());
        product.setRatingAvg(BigDecimal.ZERO);
        product.setReviewCount(0);

        ProductEntity saved = productRepository.save(product);
        outboxService.publish("PRODUCT", saved.getId().toString(), "PRODUCT_CREATED",
                Map.of("productId", saved.getId(), "sellerId", saved.getSellerId()));
        return saved;
    }

    @PreAuthorize("hasRole('SELLER')")
    @Transactional
    public ProductResponse updateProduct(AuthenticatedUser principal, Long productId, ProductUpsertRequest request) {
        ProductEntity product = productRepository.findByIdAndDeletedAtIsNull(productId)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        UUID sellerId = UUID.fromString(principal.userId());
        if (!sellerId.equals(product.getSellerId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You can only update your own products");
        }

        product.setCategoryId(request.subCategoryId());
        product.setName(request.name().trim());
        product.setSlug(toSlug(request.name()));
        product.setShortDescription(request.description().trim());
        product.setDescription(request.description().trim());
        product.setThumbnailUrl(request.thumbnail());
        product.setBasePrice(request.price());

        ProductEntity saved = productRepository.save(product);
        inventorySyncClient.upsertStock(saved.getId(), request.stock());
        outboxService.publish("PRODUCT", saved.getId().toString(), "PRODUCT_UPDATED", Map.of("productId", saved.getId()));
        return toProductResponse(saved, request.stock());
    }

    public List<ProductSnapshotResponse> getProductSnapshots(Collection<Long> productIds) {
        return productRepository.findByIdInAndDeletedAtIsNull(productIds)
                .stream()
                .map(product -> new ProductSnapshotResponse(
                        product.getId(),
                        product.getName(),
                        product.getSku(),
                        product.getThumbnailUrl(),
                        product.getBasePrice(),
                        product.getSellerId(),
                        product.isActive() && product.isPublished() && product.getDeletedAt() == null
                ))
                .toList();
    }

    public List<CouponResponse> getCoupons() {
        return couponRepository.findByActiveTrueOrderByCreatedAtDesc()
                .stream()
                .map(this::toCouponResponse)
                .toList();
    }

    public CouponValidationResponse validateCoupon(CouponValidationRequest request) {
        CouponEntity coupon = couponRepository.findByCodeIgnoreCaseAndActiveTrue(request.code().trim())
                .orElse(null);
        if (coupon == null) {
            return new CouponValidationResponse(false, BigDecimal.ZERO, "Invalid coupon code", null);
        }

        OffsetDateTime now = OffsetDateTime.now();
        if (coupon.getStartAt() != null && now.isBefore(coupon.getStartAt())) {
            return new CouponValidationResponse(false, BigDecimal.ZERO, "Coupon is not yet valid", toCouponResponse(coupon));
        }
        if (coupon.getEndAt() != null && now.isAfter(coupon.getEndAt())) {
            return new CouponValidationResponse(false, BigDecimal.ZERO, "Coupon has expired", toCouponResponse(coupon));
        }
        if (request.orderValue().compareTo(coupon.getMinOrderValue()) < 0) {
            return new CouponValidationResponse(false, BigDecimal.ZERO, "Order value does not satisfy coupon minimum", toCouponResponse(coupon));
        }
        if (coupon.getUsageLimit() != null && coupon.getUsedCount() >= coupon.getUsageLimit()) {
            return new CouponValidationResponse(false, BigDecimal.ZERO, "Coupon usage limit exceeded", toCouponResponse(coupon));
        }

        BigDecimal discount = "percent".equalsIgnoreCase(coupon.getDiscountType())
                ? request.orderValue()
                .multiply(coupon.getDiscountValue())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : coupon.getDiscountValue();

        if (coupon.getMaxDiscount() != null && discount.compareTo(coupon.getMaxDiscount()) > 0) {
            discount = coupon.getMaxDiscount();
        }

        discount = discount.setScale(2, RoundingMode.HALF_UP);

        return new CouponValidationResponse(true, discount, "Coupon applied successfully", toCouponResponse(coupon));
    }

    @Transactional
    public void consumeCoupon(CouponConsumeRequest request) {
        CouponEntity coupon = couponRepository.findById(request.couponId())
                .orElseThrow(() -> new EntityNotFoundException("Coupon not found"));
        coupon.setUsedCount(coupon.getUsedCount() + 1);
        couponRepository.save(coupon);

        CouponUsageEntity usage = new CouponUsageEntity();
        usage.setCouponId(request.couponId());
        usage.setUserId(request.userId());
        usage.setOrderId(request.orderId());
        usage.setUsedAt(OffsetDateTime.now());
        couponUsageRepository.save(usage);

        outboxService.publish("COUPON", coupon.getId().toString(), "COUPON_CONSUMED", Map.of("couponId", coupon.getId(), "orderId", request.orderId()));
    }

    private ProductResponse toProductResponse(ProductEntity product, int stock) {
        return new ProductResponse(
                product.getId(),
                product.getCategoryId(),
                product.getName(),
                product.getDescription(),
                product.getThumbnailUrl(),
                product.getBasePrice(),
                stock,
                null,
                product.getRatingAvg(),
                null,
                product.getCreatedAt(),
                product.getSellerId()
        );
    }

    private CouponResponse toCouponResponse(CouponEntity coupon) {
        return new CouponResponse(
                coupon.getId(),
                coupon.getCode(),
                coupon.getDescription(),
                coupon.getDiscountType(),
                coupon.getDiscountValue(),
                coupon.getMinOrderValue(),
                coupon.getMaxDiscount(),
                coupon.getStartAt(),
                coupon.getEndAt(),
                coupon.getUsageLimit(),
                coupon.getUsedCount(),
                coupon.isActive(),
                coupon.getCreatedAt()
        );
    }

    private String toSlug(String input) {
        return input.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    private Map<Long, Integer> loadStockMap(List<Long> productIds) {
        Map<Long, Integer> stockMap = new HashMap<>();
        inventoryItemViewRepository.findByProductIdInAndVariantIdIsNull(productIds)
                .forEach(item -> stockMap.put(item.getProductId(), item.getAvailableQty()));
        return stockMap;
    }
}
