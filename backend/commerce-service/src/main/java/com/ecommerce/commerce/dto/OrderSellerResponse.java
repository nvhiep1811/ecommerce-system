package com.ecommerce.commerce.dto;

import java.util.UUID;

public record OrderSellerResponse(
        UUID sellerId,
        String sellerName,
        long itemCount
) {
}
