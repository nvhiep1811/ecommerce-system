package com.ecommerce.chat.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "chat_messages")
public class ChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String content;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_url")
    private String fileUrl;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(name = "message_type", nullable = false)
    private String messageType;

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    @Column(name = "sender_role", nullable = false)
    private String senderRole;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;
}
