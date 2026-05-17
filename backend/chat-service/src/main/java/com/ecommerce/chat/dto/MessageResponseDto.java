package com.ecommerce.chat.dto;

import com.ecommerce.chat.enums.MessageType;
import com.ecommerce.chat.enums.SenderRole;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageResponseDto {

    private Long          id;
    private Long          conversationId;
    private UUID          senderId;       // UUID khớp UserEntity
    private SenderRole    senderRole;
    private String        content;
    private MessageType   messageType;
    private String        fileUrl;
    private String        fileName;
    private Long          fileSize;
    private boolean       read;
    private LocalDateTime createdAt;
}