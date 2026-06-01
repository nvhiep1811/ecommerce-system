package com.ecommerce.chat.service;

import com.ecommerce.chat.domain.ChatConversationEntity;
import com.ecommerce.chat.domain.ChatMessageEntity;
import com.ecommerce.chat.dto.ChatConversationResponse;
import com.ecommerce.chat.dto.ChatConversationsResponse;
import com.ecommerce.chat.dto.ChatMessageResponse;
import com.ecommerce.chat.dto.ChatMessagesResponse;
import com.ecommerce.chat.repository.ChatConversationRepository;
import com.ecommerce.chat.repository.ChatMessageRepository;
import com.ecommerce.chat.websocket.ChatWebSocketSessionRegistry;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class ChatService {

    private final ChatConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ChatWebSocketSessionRegistry sessionRegistry;

    public ChatService(
            ChatConversationRepository conversationRepository,
            ChatMessageRepository messageRepository,
            NamedParameterJdbcTemplate jdbcTemplate,
            ChatWebSocketSessionRegistry sessionRegistry
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.sessionRegistry = sessionRegistry;
    }

    @Transactional
    public ChatConversationResponse getOrCreateConversation(AuthenticatedUser principal, Long productId) {
        UUID customerId = userId(principal);
        ProductSummary product = getProductSummary(productId);
        if (product.sellerId() == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Product does not have a seller");
        }
        if (product.sellerId().equals(customerId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "You cannot message yourself for this product");
        }

        List<ChatConversationEntity> sellerConversations = conversationRepository
                .findAllByCustomerIdAndSellerIdOrderByCreatedAtAscIdAsc(customerId, product.sellerId());
        ChatConversationEntity conversation;

        if (sellerConversations.isEmpty()) {
            OffsetDateTime now = OffsetDateTime.now();
            ChatConversationEntity created = new ChatConversationEntity();
            created.setCustomerId(customerId);
            created.setSellerId(product.sellerId());
            created.setProductId(product.id());
            created.setStatus("ACTIVE");
            created.setCreatedAt(now);
            created.setUpdatedAt(now);
            conversation = conversationRepository.save(created);
        } else {
            conversation = sellerConversations.get(0);
            mergeDuplicateSellerConversations(conversation, sellerConversations.subList(1, sellerConversations.size()));

            if (!product.id().equals(conversation.getProductId()) || !"ACTIVE".equals(conversation.getStatus())) {
                conversation.setProductId(product.id());
                conversation.setStatus("ACTIVE");
                conversation.setUpdatedAt(OffsetDateTime.now());
                conversation = conversationRepository.save(conversation);
            }
        }

        return getConversation(principal, conversation.getId());
    }

    private void mergeDuplicateSellerConversations(
            ChatConversationEntity canonicalConversation,
            List<ChatConversationEntity> duplicateConversations
    ) {
        if (duplicateConversations.isEmpty()) {
            return;
        }

        List<Long> duplicateIds = duplicateConversations.stream()
                .map(ChatConversationEntity::getId)
                .toList();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("canonicalConversationId", canonicalConversation.getId())
                .addValue("duplicateIds", duplicateIds);

        jdbcTemplate.update(
                """
                update chat_messages
                set conversation_id = :canonicalConversationId
                where conversation_id in (:duplicateIds)
                """,
                params
        );
        jdbcTemplate.update(
                """
                delete from chat_conversation_deletions
                where conversation_id in (:duplicateIds)
                """,
                params
        );
        jdbcTemplate.update(
                """
                delete from chat_conversations
                where id in (:duplicateIds)
                """,
                params
        );
    }

    private ProductSummary getProductSummary(Long productId) {
        return jdbcTemplate.query(
                        """
                        select id, seller_id
                        from products
                        where id = :productId and deleted_at is null
                        """,
                        new MapSqlParameterSource("productId", productId),
                        (rs, rowNum) -> new ProductSummary(
                                rs.getLong("id"),
                                (UUID) rs.getObject("seller_id")
                        )
                )
                .stream()
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
    }

    @Transactional(readOnly = true)
    public ChatConversationsResponse getConversations(AuthenticatedUser principal) {
        UUID currentUserId = userId(principal);
        List<ChatConversationResponse> items = jdbcTemplate.query(
                """
                select cc.id,
                       cc.customer_id,
                       customer.full_name as customer_name,
                       customer.avatar_url as customer_avatar_url,
                       cc.seller_id,
                       seller.full_name as seller_name,
                       seller.avatar_url as seller_avatar_url,
                       case
                         when cc.customer_id = :userId then seller.full_name
                         else customer.full_name
                       end as peer_name,
                       case
                         when cc.customer_id = :userId then seller.avatar_url
                         else customer.avatar_url
                       end as peer_avatar_url,
                       cc.product_id,
                       p.name as product_name,
                       p.thumbnail_url as product_thumbnail,
                       p.base_price as product_price,
                       cc.status,
                       last_message.content as last_message,
                       last_message.created_at as last_message_at,
                       cc.created_at,
                       cc.updated_at,
                       (
                         select count(*)
                         from chat_messages unread
                         where unread.conversation_id = cc.id
                           and unread.is_deleted = false
                           and unread.is_read = false
                           and unread.sender_id <> :userId
                           and (deletion.deleted_at is null or unread.created_at > deletion.deleted_at)
                       ) as unread_count
                from chat_conversations cc
                left join products p on p.id = cc.product_id
                left join users customer on customer.id = cc.customer_id
                left join users seller on seller.id = cc.seller_id
                left join chat_conversation_deletions deletion
                  on deletion.conversation_id = cc.id
                 and deletion.user_id = :userId
                left join lateral (
                    select coalesce(
                              nullif(cm.content, ''),
                              case
                                when cm.message_type = 'IMAGE' then 'Đã gửi một ảnh'
                                when cm.message_type = 'FILE' then 'Đã gửi một tệp'
                                else 'Tin nhắn'
                              end
                           ) as content,
                           cm.created_at
                    from chat_messages cm
                    where cm.conversation_id = cc.id
                      and cm.is_deleted = false
                    order by cm.created_at desc nulls last, cm.id desc
                    limit 1
                ) last_message on true
                where (cc.customer_id = :userId or cc.seller_id = :userId)
                  and (
                    deletion.deleted_at is null
                    or coalesce(last_message.created_at, cc.updated_at, cc.created_at) > deletion.deleted_at
                  )
                order by coalesce(last_message.created_at, cc.updated_at, cc.created_at) desc nulls last, cc.id desc
                """,
                new MapSqlParameterSource("userId", currentUserId),
                (rs, rowNum) -> toConversationResponse(currentUserId, rs)
        );
        return new ChatConversationsResponse(items);
    }

    @Transactional(readOnly = true)
    public ChatConversationResponse getConversation(AuthenticatedUser principal, Long conversationId) {
        UUID currentUserId = userId(principal);
        return jdbcTemplate.query(
                        """
                        select cc.id,
                               cc.customer_id,
                               customer.full_name as customer_name,
                               customer.avatar_url as customer_avatar_url,
                               cc.seller_id,
                               seller.full_name as seller_name,
                               seller.avatar_url as seller_avatar_url,
                               case
                                 when cc.customer_id = :userId then seller.full_name
                                 else customer.full_name
                               end as peer_name,
                               case
                                 when cc.customer_id = :userId then seller.avatar_url
                                 else customer.avatar_url
                               end as peer_avatar_url,
                               cc.product_id,
                               p.name as product_name,
                               p.thumbnail_url as product_thumbnail,
                               p.base_price as product_price,
                               cc.status,
                               last_message.content as last_message,
                               last_message.created_at as last_message_at,
                               cc.created_at,
                               cc.updated_at,
                               (
                                 select count(*)
                                 from chat_messages unread
                                 where unread.conversation_id = cc.id
                                   and unread.is_deleted = false
                                   and unread.is_read = false
                                   and unread.sender_id <> :userId
                                   and (deletion.deleted_at is null or unread.created_at > deletion.deleted_at)
                               ) as unread_count
                        from chat_conversations cc
                        left join products p on p.id = cc.product_id
                        left join users customer on customer.id = cc.customer_id
                        left join users seller on seller.id = cc.seller_id
                        left join chat_conversation_deletions deletion
                          on deletion.conversation_id = cc.id
                         and deletion.user_id = :userId
                        left join lateral (
                            select nullif(cm.content, '') as content,
                                   cm.created_at
                            from chat_messages cm
                            where cm.conversation_id = cc.id
                              and cm.is_deleted = false
                            order by cm.created_at desc nulls last, cm.id desc
                            limit 1
                        ) last_message on true
                        where cc.id = :conversationId
                          and (cc.customer_id = :userId or cc.seller_id = :userId)
                        """,
                        new MapSqlParameterSource()
                                .addValue("userId", currentUserId)
                                .addValue("conversationId", conversationId),
                        (rs, rowNum) -> toConversationResponse(currentUserId, rs)
                )
                .stream()
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found"));
    }

    @Transactional
    public ChatMessagesResponse getMessages(AuthenticatedUser principal, Long conversationId) {
        UUID readerId = userId(principal);
        assertParticipantEntity(readerId, conversationId);
        markConversationRead(readerId, conversationId);
        OffsetDateTime deletedAt = getConversationDeletedAt(readerId, conversationId);
        List<ChatMessageResponse> items = messageRepository
                .findByConversationIdAndDeletedFalseOrderByCreatedAtAscIdAsc(conversationId)
                .stream()
                .filter(message -> deletedAt == null
                        || (message.getCreatedAt() != null && message.getCreatedAt().isAfter(deletedAt)))
                .map(this::toMessageResponse)
                .toList();
        return new ChatMessagesResponse(items);
    }

    @Transactional
    public ChatMessageResponse sendMessage(AuthenticatedUser principal, Long conversationId, String content) {
        UUID senderId = userId(principal);
        ChatConversationEntity conversation = assertParticipantEntity(senderId, conversationId);
        OffsetDateTime now = OffsetDateTime.now();

        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setSenderId(senderId);
        message.setSenderRole(senderId.equals(conversation.getSellerId()) ? "SELLER" : "CUSTOMER");
        message.setMessageType("TEXT");
        message.setContent(content.trim());
        message.setRead(false);
        message.setDeleted(false);
        message.setCreatedAt(now);

        conversation.setUpdatedAt(now);
        conversationRepository.save(conversation);
        ChatMessageResponse response = toMessageResponse(messageRepository.save(message));
        broadcastAfterCommit(response);
        return response;
    }

    @Transactional
    public ChatMessageResponse sendMediaMessage(
            AuthenticatedUser principal,
            Long conversationId,
            ChatMediaStorageService.StoredMedia media
    ) {
        UUID senderId = userId(principal);
        ChatConversationEntity conversation = assertParticipantEntity(senderId, conversationId);
        OffsetDateTime now = OffsetDateTime.now();

        ChatMessageEntity message = new ChatMessageEntity();
        message.setConversationId(conversation.getId());
        message.setSenderId(senderId);
        message.setSenderRole(senderId.equals(conversation.getSellerId()) ? "SELLER" : "CUSTOMER");
        message.setMessageType(media.messageType());
        message.setContent(mediaCaption(media));
        message.setFileUrl(media.publicUrl());
        message.setFileName(media.fileName());
        message.setFileSize(media.fileSize());
        message.setRead(false);
        message.setDeleted(false);
        message.setCreatedAt(now);

        conversation.setUpdatedAt(now);
        conversationRepository.save(conversation);
        ChatMessageResponse response = toMessageResponse(messageRepository.save(message));
        broadcastAfterCommit(response);
        return response;
    }

    private String mediaCaption(ChatMediaStorageService.StoredMedia media) {
        if ("IMAGE".equals(media.messageType())) {
            return "Đã gửi một ảnh";
        }
        String contentType = media.contentType() == null ? "" : media.contentType();
        if (contentType.startsWith("video/")) {
            return "Đã gửi một video";
        }
        return "Đã gửi một tệp";
    }

    @Transactional
    public void markConversationRead(AuthenticatedUser principal, Long conversationId) {
        markConversationRead(userId(principal), conversationId);
    }

    @Transactional
    public void deleteConversation(AuthenticatedUser principal, Long conversationId) {
        UUID requesterId = userId(principal);
        assertParticipantEntity(requesterId, conversationId);
        jdbcTemplate.update(
                """
                insert into chat_conversation_deletions (conversation_id, user_id, deleted_at)
                values (:conversationId, :userId, now())
                on conflict (conversation_id, user_id)
                do update set deleted_at = excluded.deleted_at
                """,
                new MapSqlParameterSource()
                        .addValue("conversationId", conversationId)
                        .addValue("userId", requesterId)
        );
    }

    private void markConversationRead(UUID readerId, Long conversationId) {
        assertParticipantEntity(readerId, conversationId);
        OffsetDateTime deletedAt = getConversationDeletedAt(readerId, conversationId);
        int updated = deletedAt == null
                ? messageRepository.markIncomingMessagesRead(conversationId, readerId)
                : messageRepository.markIncomingMessagesReadAfter(conversationId, readerId, deletedAt);
        if (updated > 0) {
            broadcastReadAfterCommit(conversationId, readerId);
        }
    }

    @Transactional(readOnly = true)
    public ChatMessageResponse getMessageForRealtime(Long messageId) {
        return messageRepository.findById(messageId)
                .filter(message -> !message.isDeleted())
                .map(this::toMessageResponse)
                .orElseThrow(() -> new EntityNotFoundException("Message not found"));
    }

    @Transactional(readOnly = true)
    public void assertCanAccess(UUID userId, Long conversationId) {
        assertParticipantEntity(userId, conversationId);
    }

    private ChatConversationEntity assertParticipantEntity(UUID userId, Long conversationId) {
        ChatConversationEntity conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found"));
        if (!userId.equals(conversation.getCustomerId()) && !userId.equals(conversation.getSellerId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You are not a participant of this conversation");
        }
        return conversation;
    }

    private UUID userId(AuthenticatedUser principal) {
        return UUID.fromString(principal.userId());
    }

    private void broadcastAfterCommit(ChatMessageResponse message) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            sessionRegistry.broadcast(message);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                sessionRegistry.broadcast(message);
            }
        });
    }

    private void broadcastReadAfterCommit(Long conversationId, UUID readerId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            sessionRegistry.broadcastRead(conversationId, readerId);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                sessionRegistry.broadcastRead(conversationId, readerId);
            }
        });
    }

    private OffsetDateTime getConversationDeletedAt(UUID userId, Long conversationId) {
        return jdbcTemplate.query(
                        """
                        select deleted_at
                        from chat_conversation_deletions
                        where conversation_id = :conversationId
                          and user_id = :userId
                        """,
                        new MapSqlParameterSource()
                                .addValue("conversationId", conversationId)
                                .addValue("userId", userId),
                        (rs, rowNum) -> toOffsetDateTime(rs.getTimestamp("deleted_at"))
                )
                .stream()
                .findFirst()
                .orElse(null);
    }

    private ChatConversationResponse toConversationResponse(UUID currentUserId, java.sql.ResultSet rs) throws SQLException {
        UUID customerId = (UUID) rs.getObject("customer_id");
        UUID sellerId = (UUID) rs.getObject("seller_id");
        UUID peerId = currentUserId.equals(customerId) ? sellerId : customerId;
        return new ChatConversationResponse(
                rs.getLong("id"),
                customerId,
                rs.getString("customer_name"),
                rs.getString("customer_avatar_url"),
                sellerId,
                rs.getString("seller_name"),
                rs.getString("seller_avatar_url"),
                rs.getString("peer_name"),
                rs.getString("peer_avatar_url"),
                getNullableLong(rs.getObject("product_id")),
                rs.getString("product_name"),
                rs.getString("product_thumbnail"),
                rs.getBigDecimal("product_price"),
                rs.getString("status"),
                rs.getString("last_message"),
                toOffsetDateTime(rs.getTimestamp("last_message_at")),
                rs.getInt("unread_count"),
                sessionRegistry.isUserOnline(peerId),
                toOffsetDateTime(rs.getTimestamp("created_at")),
                toOffsetDateTime(rs.getTimestamp("updated_at"))
        );
    }

    private ChatMessageResponse toMessageResponse(ChatMessageEntity message) {
        return new ChatMessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getSenderRole(),
                message.getMessageType(),
                message.getContent(),
                message.getFileUrl(),
                message.getFileName(),
                message.getFileSize(),
                message.isRead(),
                message.getCreatedAt()
        );
    }

    private static Long getNullableLong(Object value) {
        if (value == null) {
            return null;
        }
        return ((Number) value).longValue();
    }

    private static OffsetDateTime toOffsetDateTime(Timestamp value) {
        return value == null ? null : value.toInstant().atOffset(ZoneOffset.UTC);
    }

    private record ProductSummary(Long id, UUID sellerId) {
    }
}
