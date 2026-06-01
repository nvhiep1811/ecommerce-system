package com.ecommerce.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UnreadCountResponseDto {

    private long totalUnread;
    private Long conversationId; // null = tong tat ca conversations
}