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
import com.ecommerce.catalog.dto.ProductPageResponse;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
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
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ProductPageReadCache productPageReadCache;

    public CatalogService(
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            CouponRepository couponRepository,
            CouponUsageRepository couponUsageRepository,
            InventoryItemViewRepository inventoryItemViewRepository,
            InventorySyncClient inventorySyncClient,
            OutboxService outboxService,
            NamedParameterJdbcTemplate jdbcTemplate,
            ProductPageReadCache productPageReadCache
    ) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.couponRepository = couponRepository;
        this.couponUsageRepository = couponUsageRepository;
        this.inventoryItemViewRepository = inventoryItemViewRepository;
        this.inventorySyncClient = inventorySyncClient;
        this.outboxService = outboxService;
        this.jdbcTemplate = jdbcTemplate;
        this.productPageReadCache = productPageReadCache;
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
        Map<UUID, String> sellerNameMap = loadSellerNameMap(products);
        return products.stream()
                .map(product -> toProductResponse(product, stockMap.getOrDefault(product.getId(), 0), sellerNameMap))
                .toList();
    }

    public ProductPageResponse getProductsPage(
            Long categoryId,
            UUID sellerId,
            String search,
            boolean featured,
            int page,
            int size,
            String sort,
            String direction
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 50);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, resolveSort(sort, direction, featured));
        List<Long> categoryIds = resolveCategoryIds(categoryId);
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);
        ProductPageReadCache.Key cacheKey = sellerId == null
                ? productPageCacheKey(categoryId, normalizedSearch, featured, safePage, safeSize, sort, direction)
                : null;

        if (cacheKey != null) {
            var cachedPage = productPageReadCache.get(cacheKey);
            if (cachedPage.isPresent()) {
                return cachedProductPageResponse(cachedPage.get());
            }
        }

        Page<ProductEntity> products = productRepository.findAll((root, query, criteriaBuilder) -> {
            var predicate = criteriaBuilder.conjunction();

            if (sellerId != null) {
                predicate = criteriaBuilder.and(predicate, criteriaBuilder.equal(root.get("sellerId"), sellerId));
                predicate = criteriaBuilder.and(predicate, criteriaBuilder.isNull(root.get("deletedAt")));
                return predicate;
            }

            predicate = criteriaBuilder.and(predicate, criteriaBuilder.isNull(root.get("deletedAt")));
            predicate = criteriaBuilder.and(predicate, criteriaBuilder.isTrue(root.get("active")));
            predicate = criteriaBuilder.and(predicate, criteriaBuilder.isTrue(root.get("published")));

            if (!categoryIds.isEmpty()) {
                predicate = criteriaBuilder.and(predicate, root.get("categoryId").in(categoryIds));
            }

            if (normalizedSearch != null) {
                predicate = criteriaBuilder.and(
                        predicate,
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), "%" + normalizedSearch + "%")
                );
            }

            return predicate;
        }, pageRequest);

        List<ProductEntity> content = products.getContent();
        if (cacheKey != null) {
            productPageReadCache.put(
                    cacheKey,
                    new ProductPageReadCache.CachedPage(
                            content.stream().map(ProductEntity::getId).toList(),
                            products.getNumber(),
                            products.getSize(),
                            products.getTotalElements(),
                            products.getTotalPages(),
                            products.hasNext()
                    )
            );
        }

        return productPageResponse(
                content,
                products.getNumber(),
                products.getSize(),
                products.getTotalElements(),
                products.getTotalPages(),
                products.hasNext()
        );
    }

    private List<Long> resolveCategoryIds(Long categoryId) {
        if (categoryId == null) {
            return List.of();
        }

        List<Long> categoryIds = categoryRepository.findByParentIdAndActiveTrueOrderByNameAsc(categoryId)
                .stream()
                .map(CategoryEntity::getId)
                .collect(Collectors.toList());
        categoryIds.add(categoryId);
        return categoryIds;
    }

    private Sort resolveSort(String sort, String direction, boolean featured) {
        Sort.Direction sortDirection = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String normalizedSort = sort == null ? "" : sort.trim().toLowerCase(Locale.ROOT);

        if ("price".equals(normalizedSort)) {
            return Sort.by(sortDirection, "basePrice").and(Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        if ("rating".equals(normalizedSort) || featured) {
            return Sort.by(Sort.Direction.DESC, "ratingAvg").and(Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        return Sort.by(Sort.Direction.DESC, "createdAt");
    }

    private ProductPageReadCache.Key productPageCacheKey(
            Long categoryId,
            String normalizedSearch,
            boolean featured,
            int page,
            int size,
            String sort,
            String direction
    ) {
        return new ProductPageReadCache.Key(
                categoryId,
                normalizedSearch == null ? "" : normalizedSearch,
                featured,
                page,
                size,
                sort == null ? "createdat" : sort.trim().toLowerCase(Locale.ROOT),
                "asc".equalsIgnoreCase(direction) ? "asc" : "desc"
        );
    }

    private ProductPageResponse cachedProductPageResponse(ProductPageReadCache.CachedPage cachedPage) {
        if (cachedPage.productIds().isEmpty()) {
            return new ProductPageResponse(
                    List.of(),
                    cachedPage.page(),
                    cachedPage.size(),
                    cachedPage.totalElements(),
                    cachedPage.totalPages(),
                    cachedPage.hasNext()
            );
        }

        Map<Long, ProductEntity> productsById = productRepository.findByIdInAndDeletedAtIsNull(cachedPage.productIds())
                .stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        List<ProductEntity> products = cachedPage.productIds().stream()
                .map(productsById::get)
                .filter(Objects::nonNull)
                .toList();

        return productPageResponse(
                products,
                cachedPage.page(),
                cachedPage.size(),
                cachedPage.totalElements(),
                cachedPage.totalPages(),
                cachedPage.hasNext()
        );
    }

    private ProductPageResponse productPageResponse(
            List<ProductEntity> products,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean hasNext
    ) {
        Map<Long, Integer> stockMap = loadStockMap(products.stream().map(ProductEntity::getId).toList());
        Map<UUID, String> sellerNameMap = loadSellerNameMap(products);
        List<ProductResponse> items = products.stream()
                .map(product -> toProductResponse(product, stockMap.getOrDefault(product.getId(), 0), sellerNameMap))
                .toList();

        return new ProductPageResponse(items, page, size, totalElements, totalPages, hasNext);
    }

    public ProductResponse getProduct(Long id) {
        ProductEntity product = productRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        int stock = inventoryItemViewRepository.findByProductIdAndVariantIdIsNull(id)
                .map(InventoryItemView::getAvailableQty)
                .orElse(0);
        return toProductResponse(product, stock, loadSellerNameMap(List.of(product)));
    }

    @PreAuthorize("hasRole('SELLER')")
    public ProductResponse createProduct(AuthenticatedUser principal, ProductUpsertRequest request) {
        // Save và commit
        ProductEntity saved = saveProduct(principal, request);

        // Gọi inventory-service SAU KHI đã commit
        inventorySyncClient.upsertStock(saved.getId(), request.stock());
        productPageReadCache.evictAll();

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
        productPageReadCache.evictAll();
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
        productPageReadCache.evictAll();
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
        return toProductResponse(product, stock, Map.of());
    }

    private ProductResponse toProductResponse(ProductEntity product, int stock, Map<UUID, String> sellerNameMap) {
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
                product.getReviewCount(),
                null,
                product.getCreatedAt(),
                product.getSellerId(),
                product.getSellerId() == null ? null : sellerNameMap.get(product.getSellerId())
        );
    }

    private Map<UUID, String> loadSellerNameMap(List<ProductEntity> products) {
        List<UUID> sellerIds = products.stream()
                .map(ProductEntity::getSellerId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (sellerIds.isEmpty()) {
            return Map.of();
        }

        return jdbcTemplate.query(
                """
                select distinct u.id, u.full_name
                from users u
                join user_roles ur on ur.user_id = u.id
                where u.id in (:sellerIds)
                  and ur.role_code = 'SELLER'
                """,
                new MapSqlParameterSource("sellerIds", sellerIds),
                rs -> {
                    Map<UUID, String> sellerNames = new HashMap<>();
                    while (rs.next()) {
                        sellerNames.put((UUID) rs.getObject("id"), rs.getString("full_name"));
                    }
                    return sellerNames;
                }
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
        if (productIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, Integer> stockMap = new HashMap<>();
        inventoryItemViewRepository.findByProductIdInAndVariantIdIsNull(productIds)
                .forEach(item -> stockMap.put(item.getProductId(), item.getAvailableQty()));
        return stockMap;
    }
}
