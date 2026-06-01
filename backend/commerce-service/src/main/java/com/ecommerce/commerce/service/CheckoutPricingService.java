package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.CatalogClient;
import com.ecommerce.commerce.domain.ShippingMethodEntity;
import com.ecommerce.commerce.dto.CouponValidationResponse;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.dto.ProductSnapshotRequest;
import com.ecommerce.commerce.dto.ProductSnapshotResponse;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CheckoutPricingService {

    private final CatalogClient catalogClient;
    private final ShippingMethodService shippingMethodService;
    private final FlashSaleCheckoutService flashSaleCheckoutService;
    private final CheckoutValidationService checkoutValidationService;
    private final PaymentMethodService paymentMethodService;

    public CheckoutPricingService(
            CatalogClient catalogClient,
            ShippingMethodService shippingMethodService,
            FlashSaleCheckoutService flashSaleCheckoutService,
            CheckoutValidationService checkoutValidationService,
            PaymentMethodService paymentMethodService
    ) {
        this.catalogClient = catalogClient;
        this.shippingMethodService = shippingMethodService;
        this.flashSaleCheckoutService = flashSaleCheckoutService;
        this.checkoutValidationService = checkoutValidationService;
        this.paymentMethodService = paymentMethodService;
    }

    /**
     * Tính toán toàn bộ pricing cho một checkout request.
     * Bao gồm: product snapshot, flash sale price, coupon, shipping, tax, grand total.
     */
    public CheckoutPricing prepare(
            UUID userId,
            List<OrderLineRequest> items,
            String couponCode,
            String paymentMethod,
            Long shippingMethodId
    ) {
        // 1. Lấy product snapshots và validate
        Map<String, ProductSnapshotResponse> snapshotMap = fetchAndValidateSnapshots(items);

        // 2. Resolve flash sale reservations nếu có
        Map<String, FlashSaleCheckoutReservation> flashSaleReservationMap =
                resolveFlashSaleReservations(userId, items);

        // 3. Tính subtotal
        BigDecimal subtotal = items.stream()
                .map(item -> unitPrice(item, snapshotMap, flashSaleReservationMap)
                        .multiply(BigDecimal.valueOf(item.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        // 4. Validate và tính coupon discount
        CouponValidationResponse couponValidation = null;
        BigDecimal discount = BigDecimal.ZERO;
        if (couponCode != null && !couponCode.isBlank()) {
            couponValidation = catalogClient.validateCoupon(couponCode, subtotal);
            if (!couponValidation.valid()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, couponValidation.message());
            }
            discount = couponValidation.discount().setScale(2, RoundingMode.HALF_UP);
        }

        // 5. Resolve shipping method
        ShippingMethodEntity shippingMethod = shippingMethodService.resolveActive(shippingMethodId);
        BigDecimal shippingFee = shippingMethod.getFee().setScale(2, RoundingMode.HALF_UP);

        // 6. Tính tax và grand total
        BigDecimal tax = subtotal.multiply(BigDecimal.valueOf(0.10)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(shippingFee).add(tax).subtract(discount).setScale(2, RoundingMode.HALF_UP);

        // 7. Normalize và validate payment method
        String normalizedPaymentMethod = checkoutValidationService.normalizePaymentMethod(paymentMethod);
        String validatedPaymentMethod = checkoutValidationService.validatePaymentMethod(normalizedPaymentMethod, paymentMethodService);

        return new CheckoutPricing(
                snapshotMap,
                subtotal,
                tax,
                shippingFee,
                discount,
                total,
                couponValidation,
                validatedPaymentMethod,
                shippingMethod.getId(),
                shippingMethod.getName(),
                flashSaleReservationMap
        );
    }

    private Map<String, ProductSnapshotResponse> fetchAndValidateSnapshots(List<OrderLineRequest> items) {
        List<ProductSnapshotResponse> snapshots = catalogClient.getProductSnapshots(
                items.stream()
                        .map(item -> new ProductSnapshotRequest.ProductSnapshotLineRequest(item.productId(), item.variantId()))
                        .toList()
        );

        Map<String, ProductSnapshotResponse> snapshotMap = snapshots.stream()
                .collect(Collectors.toMap(
                        snapshot -> lineKey(snapshot.productId(), snapshot.variantId()),
                        Function.identity(),
                        (left, right) -> left
                ));

        items.forEach(item -> {
            ProductSnapshotResponse snapshot = snapshotMap.get(lineKey(item.productId(), item.variantId()));
            if (snapshot == null || !snapshot.active()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Product " + item.productId() + " is unavailable");
            }
        });

        return snapshotMap;
    }

    private Map<String, FlashSaleCheckoutReservation> resolveFlashSaleReservations(UUID userId, List<OrderLineRequest> items) {
        boolean hasFlashSaleReservation = items.stream()
                .anyMatch(item -> item.flashSaleReservationToken() != null
                        && !item.flashSaleReservationToken().isBlank());
        if (!hasFlashSaleReservation) {
            return Map.of();
        }
        if (userId == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Authentication is required for flash sale checkout");
        }
        return flashSaleCheckoutService.resolveForPricing(userId, items).stream()
                .collect(Collectors.toMap(FlashSaleCheckoutReservation::reservationToken, Function.identity()));
    }

    private BigDecimal unitPrice(
            OrderLineRequest item,
            Map<String, ProductSnapshotResponse> snapshotMap,
            Map<String, FlashSaleCheckoutReservation> flashSaleReservationMap
    ) {
        String token = item.flashSaleReservationToken();
        if (token != null && !token.isBlank()) {
            FlashSaleCheckoutReservation reservation = flashSaleReservationMap.get(token.trim());
            if (reservation == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale reservation is invalid");
            }
            return reservation.salePrice();
        }
        return snapshotMap.get(lineKey(item.productId(), item.variantId())).price();
    }

    private static String lineKey(Long productId, Long variantId) {
        return productId + ":" + (variantId == null ? "" : variantId);
    }
}
