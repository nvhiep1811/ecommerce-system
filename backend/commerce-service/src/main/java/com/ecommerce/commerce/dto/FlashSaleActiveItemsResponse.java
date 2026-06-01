package com.ecommerce.commerce.dto;

import java.util.List;

public record FlashSaleActiveItemsResponse(
        List<FlashSaleItemResponse> items
) {
}
