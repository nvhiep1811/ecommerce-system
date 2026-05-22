package com.ecommerce.commerce.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record OrderLineRequest(
        @NotNull Long productId,
        Long variantId,
        @NotNull @Min(1) Integer quantity,
        Long flashSaleCampaignId,
        Long flashSaleItemId,
        String flashSaleReservationToken
) {
    public OrderLineRequest(Long productId, Long variantId, Integer quantity) {
        this(productId, variantId, quantity, null, null, null);
    }
}
