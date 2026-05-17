package com.ecommerce.chat.repository;

import com.ecommerce.chat.domain.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    @Query("""
        SELECT m FROM ChatMessage m
        WHERE m.conversation.id = :conversationId
          AND m.isDeleted = false
        ORDER BY m.createdAt DESC
    """)
    Page<ChatMessage> findByConversationId(
            @Param("conversationId") Long conversationId,
            Pageable pageable
    );

    @Query("""
        SELECT COUNT(m) FROM ChatMessage m
        WHERE m.conversation.id = :conversationId
          AND m.senderId <> :currentUserId
          AND m.isRead   = false
          AND m.isDeleted = false
    """)
    long countUnread(
            @Param("conversationId") Long conversationId,
            @Param("currentUserId")  UUID currentUserId
    );

    @Query("""
        SELECT COUNT(m) FROM ChatMessage m
        JOIN m.conversation c
        WHERE (c.customerId = :userId OR c.sellerId = :userId)
          AND m.senderId <> :userId
          AND m.isRead    = false
          AND m.isDeleted = false
    """)
    long countTotalUnread(@Param("userId") UUID userId);

    @Modifying
    @Query("""
        UPDATE ChatMessage m
        SET m.isRead = true
        WHERE m.conversation.id = :conversationId
          AND m.senderId <> :currentUserId
          AND m.isRead   = false
    """)
    void markAllAsRead(
            @Param("conversationId") Long conversationId,
            @Param("currentUserId")  UUID currentUserId
    );
}