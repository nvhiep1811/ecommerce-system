package com.ecommerce.chat.repository;

import com.ecommerce.chat.domain.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {

    List<ChatMessageEntity> findByConversationIdAndDeletedFalseOrderByCreatedAtAscIdAsc(Long conversationId);

    @Modifying
    @Query("""
            update ChatMessageEntity message
               set message.read = true
             where message.conversationId = :conversationId
               and message.deleted = false
               and message.read = false
               and message.senderId <> :readerId
            """)
    int markIncomingMessagesRead(
            @Param("conversationId") Long conversationId,
            @Param("readerId") UUID readerId
    );

    @Modifying
    @Query("""
            update ChatMessageEntity message
               set message.read = true
             where message.conversationId = :conversationId
               and message.deleted = false
               and message.read = false
               and message.senderId <> :readerId
               and message.createdAt > :deletedAfter
            """)
    int markIncomingMessagesReadAfter(
            @Param("conversationId") Long conversationId,
            @Param("readerId") UUID readerId,
            @Param("deletedAfter") OffsetDateTime deletedAfter
    );
}
