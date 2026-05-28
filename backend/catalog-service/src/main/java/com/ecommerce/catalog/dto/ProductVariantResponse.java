package com.ecommerce.catalog.dto;

import java.math.BigDecimal;
import java.util.Map;

public record ProductVariantResponse(
        Long id,
        String sku,
        String variantName,
        Map<String, Object> combination,
        BigDecimal price,
        Integer stock,
        String thumbnail,
        boolean active
) {
}
