package com.ecommerce.catalog.service;

import com.ecommerce.catalog.client.InventorySyncClient;
import com.ecommerce.catalog.domain.CouponEntity;
import com.ecommerce.catalog.domain.ProductEntity;
import com.ecommerce.catalog.dto.CouponValidationRequest;
import com.ecommerce.catalog.dto.CouponValidationResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.catalog.repository.CategoryRepository;
import com.ecommerce.catalog.repository.CouponRepository;
import com.ecommerce.catalog.repository.CouponUsageRepository;
import com.ecommerce.catalog.repository.InventoryItemViewRepository;
import com.ecommerce.catalog.repository.ProductRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTest {

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CouponRepository couponRepository;

    @Mock
    private CouponUsageRepository couponUsageRepository;

    @Mock
    private InventoryItemViewRepository inventoryItemViewRepository;

    @Mock
    private InventorySyncClient inventorySyncClient;

    @Mock
    private OutboxService outboxService;

    @InjectMocks
    private CatalogService catalogService;

    @Test
    void validateCouponAppliesPercentDiscountWithMaxCap() {
        CouponEntity coupon = new CouponEntity();
        coupon.setId(12L);
        coupon.setCode("SAVE15");
        coupon.setDescription("15 percent off");
        coupon.setDiscountType("percent");
        coupon.setDiscountValue(new BigDecimal("15"));
        coupon.setMinOrderValue(new BigDecimal("50.00"));
        coupon.setMaxDiscount(new BigDecimal("12.00"));
        coupon.setStartAt(OffsetDateTime.now().minusDays(1));
        coupon.setEndAt(OffsetDateTime.now().plusDays(1));
        coupon.setUsageLimit(100);
        coupon.setUsedCount(5);
        coupon.setActive(true);

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("SAVE15")).thenReturn(Optional.of(coupon));

        CouponValidationResponse response = catalogService.validateCoupon(
                new CouponValidationRequest("SAVE15", new BigDecimal("100.05"))
        );

        assertTrue(response.valid());
        assertEquals(new BigDecimal("12.00"), response.discount());
        assertEquals("Coupon applied successfully", response.message());
        assertEquals("SAVE15", response.coupon().code());
    }

    @Test
    void createProductAssignsSellerSlugAndTriggersInventorySync() {
        UUID sellerId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(sellerId.toString(), "seller@example.com", java.util.List.of("SELLER"));
        ProductUpsertRequest request = new ProductUpsertRequest(
                "Fresh Apple Juice",
                "Cold pressed juice",
                new BigDecimal("9.99"),
                7L,
                12,
                "bottle",
                "apple-juice.jpg"
        );

        when(productRepository.save(any(ProductEntity.class))).thenAnswer(invocation -> {
            ProductEntity product = invocation.getArgument(0);
            product.setId(55L);
            return product;
        });

        ProductResponse response = catalogService.createProduct(principal, request);

        ArgumentCaptor<ProductEntity> productCaptor = ArgumentCaptor.forClass(ProductEntity.class);
        verify(productRepository).save(productCaptor.capture());
        ProductEntity savedProduct = productCaptor.getValue();

        assertEquals(sellerId, savedProduct.getSellerId());
        assertEquals(7L, savedProduct.getCategoryId());
        assertEquals("Fresh Apple Juice", savedProduct.getName());
        assertEquals("fresh-apple-juice", savedProduct.getSlug());
        assertEquals(new BigDecimal("9.99"), savedProduct.getBasePrice());
        assertTrue(savedProduct.isActive());
        assertTrue(savedProduct.isPublished());
        assertNotNull(savedProduct.getPublishedAt());
        assertTrue(savedProduct.getSku().startsWith("SKU-"));

        verify(inventorySyncClient).upsertStock(55L, 12);
        verify(outboxService).publish(eq("PRODUCT"), eq("55"), eq("PRODUCT_CREATED"), any());

        assertEquals(55L, response.id());
        assertEquals(12, response.stock());
        assertEquals(sellerId, response.sellerId());
    }

    @Test
    void updateProductRejectsDifferentSeller() {
        UUID ownerId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();
        ProductEntity product = new ProductEntity();
        product.setId(88L);
        product.setSellerId(ownerId);

        when(productRepository.findByIdAndDeletedAtIsNull(88L)).thenReturn(Optional.of(product));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> catalogService.updateProduct(
                        new AuthenticatedUser(attackerId.toString(), "attacker@example.com", java.util.List.of("SELLER")),
                        88L,
                        new ProductUpsertRequest("Tea", "Premium tea", new BigDecimal("4.99"), 2L, 5, "box", null)
                )
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatus());
        assertEquals("You can only update your own products", exception.getMessage());
        verify(productRepository, never()).save(any(ProductEntity.class));
        verifyNoInteractions(inventorySyncClient, outboxService);
    }

    @Test
    void validateCouponRejectsOrderBelowMinimum() {
        CouponEntity coupon = new CouponEntity();
        coupon.setId(19L);
        coupon.setCode("MIN200");
        coupon.setDescription("Minimum order required");
        coupon.setDiscountType("amount");
        coupon.setDiscountValue(new BigDecimal("20.00"));
        coupon.setMinOrderValue(new BigDecimal("200.00"));
        coupon.setUsageLimit(10);
        coupon.setUsedCount(1);
        coupon.setActive(true);

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("MIN200")).thenReturn(Optional.of(coupon));

        CouponValidationResponse response = catalogService.validateCoupon(
                new CouponValidationRequest("MIN200", new BigDecimal("199.99"))
        );

        assertFalse(response.valid());
        assertEquals(BigDecimal.ZERO, response.discount());
        assertEquals("Order value does not satisfy coupon minimum", response.message());
        assertEquals(coupon.getCode(), response.coupon().code());
    }
}
