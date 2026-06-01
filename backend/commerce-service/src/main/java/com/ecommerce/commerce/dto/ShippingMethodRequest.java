package com.ecommerce.commerce.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record ShippingMethodRequest(
        @NotBlank(message = "Name is required")
                String name,

        String description,

        @NotNull
        @Min(0)
        Integer estimatedMinDays,

        @NotNull
        @Min(0)
        Integer estimatedMaxDays,

        @NotNull(message = "Fee is required")
        @DecimalMin(value = "0.0", inclusive = true)
        BigDecimal fee
) {
}
