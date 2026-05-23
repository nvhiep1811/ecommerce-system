package com.ecommerce.assistant.dto;

import java.math.BigDecimal;

public record SuggestedProductDto(
    Long id,
    String name,
    String description,
    String thumbnail,
    BigDecimal price,
    Integer stock,
    BigDecimal rating,
    Integer reviewCount,
    String brand,
    String sellerName
) {}
