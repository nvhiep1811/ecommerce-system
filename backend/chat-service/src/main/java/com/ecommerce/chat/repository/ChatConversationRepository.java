package com.ecommerce.chat.repository;

import com.ecommerce.chat.domain.ChatConversationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ChatConversationRepository extends JpaRepository<ChatConversationEntity, Long> {

    Optional<ChatConversationEntity> findByCustomerIdAndSellerIdAndProductId(UUID customerId, UUID sellerId,
            Long productId);
}
