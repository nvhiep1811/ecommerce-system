package com.ecommerce.commerce.service;

import com.ecommerce.commerce.dto.CouponValidationResponse;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.dto.OrderQuoteResponse;
import com.ecommerce.commerce.dto.ProductSnapshotResponse;

import java.math.BigDecimal;
import java.util.Map;

public record CheckoutPricing(
        Map<String, ProductSnapshotResponse> snapshotMap,
        BigDecimal subtotal,
        BigDecimal tax,
        BigDecimal shippingFee,
        BigDecimal discount,
        BigDecimal total,
        CouponValidationResponse couponValidation,
        String paymentMethod,
        Long shippingMethodId,
        String shippingMethodName,
        Map<String, FlashSaleCheckoutReservation> flashSaleReservationMap
) {
    public Long couponId() {
        return couponValidation != null && couponValidation.coupon() != null
                ? couponValidation.coupon().id()
                : null;
    }

    public String couponCode() {
        return couponValidation != null && couponValidation.coupon() != null
                ? couponValidation.coupon().code()
                : null;
    }

    public OrderQuoteResponse toQuoteResponse() {
        return new OrderQuoteResponse(subtotal, tax, shippingFee, discount, total, paymentMethod, shippingMethodId, shippingMethodName, couponValidation);
    }

    public BigDecimal unitPrice(OrderLineRequest item) {
        String token = item.flashSaleReservationToken();
        if (token != null && !token.isBlank()) {
            FlashSaleCheckoutReservation reservation = flashSaleReservationMap.get(token.trim());
            if (reservation != null) {
                return reservation.salePrice();
            }
        }
        return snapshotMap.get(lineKey(item.productId(), item.variantId())).price();
    }

    private static String lineKey(Long productId, Long variantId) {
        return productId + ":" + (variantId == null ? "" : variantId);
    }
}
