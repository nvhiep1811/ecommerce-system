package com.ecommerce.commerce.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminFlashSaleCampaignResponse(
        Long id,
        String name,
        String status,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        List<AdminFlashSaleItemResponse> items
) {
}
