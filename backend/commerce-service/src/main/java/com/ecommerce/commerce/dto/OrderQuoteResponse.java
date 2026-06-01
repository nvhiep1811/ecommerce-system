package com.ecommerce.commerce.dto;

import java.math.BigDecimal;

public record OrderQuoteResponse(
        BigDecimal subtotal,
        BigDecimal tax,
        BigDecimal shippingFee,
        BigDecimal discount,
        BigDecimal total,
        String paymentMethod,
        Long shippingMethodId,
        String shippingMethodName,
        CouponValidationResponse coupon
) {
}
