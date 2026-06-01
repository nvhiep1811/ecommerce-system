package com.ecommerce.chat.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StartConversationRequestDto {

    @NotNull(message = "sellerId is required")
    private UUID sellerId;   // UUID khớp UserEntity

    private Long productId;  // optional
}