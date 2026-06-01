package com.ecommerce.chat.dto;

import com.ecommerce.chat.enums.ConversationStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConversationResponseDto {

    private Long               id;
    private UUID               customerId;   // UUID khớp UserEntity
    private UUID               sellerId;     // UUID khớp UserEntity
    private Long               productId;
    private ConversationStatus status;
    private long               unreadCount;
    private MessageResponseDto lastMessage;
    private LocalDateTime      updatedAt;
    private LocalDateTime      createdAt;
}