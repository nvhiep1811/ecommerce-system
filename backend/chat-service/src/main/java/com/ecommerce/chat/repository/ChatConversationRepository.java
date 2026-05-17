package com.ecommerce.chat.repository;

import com.ecommerce.chat.domain.ChatConversation;
import com.ecommerce.chat.enums.ConversationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {

    @Query("""
        SELECT c FROM ChatConversation c
        WHERE c.customerId = :customerId
          AND c.sellerId   = :sellerId
          AND (
                (:productId IS NULL AND c.productId IS NULL)
             OR c.productId = :productId
              )
    """)
    Optional<ChatConversation> findByParticipantsAndProduct(
            @Param("customerId") UUID customerId,
            @Param("sellerId")   UUID sellerId,
            @Param("productId")  Long productId
    );

    @Query("""
        SELECT c FROM ChatConversation c
        WHERE c.customerId = :userId AND c.status = :status
        ORDER BY c.updatedAt DESC
    """)
    Page<ChatConversation> findByCustomerId(
            @Param("userId") UUID userId,
            @Param("status") ConversationStatus status,
            Pageable pageable
    );

    @Query("""
        SELECT c FROM ChatConversation c
        WHERE c.sellerId = :userId AND c.status = :status
        ORDER BY c.updatedAt DESC
    """)
    Page<ChatConversation> findBySellerId(
            @Param("userId") UUID userId,
            @Param("status") ConversationStatus status,
            Pageable pageable
    );
}