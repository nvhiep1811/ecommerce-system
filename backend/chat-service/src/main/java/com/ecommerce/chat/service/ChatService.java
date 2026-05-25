package com.ecommerce.chat.service;

import com.ecommerce.chat.domain.ChatConversation;
import com.ecommerce.chat.domain.ChatMessage;
import com.ecommerce.chat.dto.*;
import com.ecommerce.chat.enums.ConversationStatus;
import com.ecommerce.chat.enums.MessageType;
import com.ecommerce.chat.enums.SenderRole;
import com.ecommerce.chat.repository.ChatConversationRepository;
import com.ecommerce.chat.repository.ChatMessageRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatConversationRepository conversationRepo;
    private final ChatMessageRepository      messageRepo;

    // ─── Conversation ─────────────────────────────────────────────

    @Transactional
    public ConversationResponseDto getOrCreateConversation(UUID customerId,
                                                           StartConversationRequestDto req) {
        ChatConversation conv = conversationRepo
                .findByParticipantsAndProduct(customerId, req.getSellerId(), req.getProductId())
                .orElseGet(() -> {
                    log.info("Creating conversation: customer={} seller={} product={}",
                            customerId, req.getSellerId(), req.getProductId());
                    return conversationRepo.save(
                            ChatConversation.builder()
                                    .customerId(customerId)
                                    .sellerId(req.getSellerId())
                                    .productId(req.getProductId())
                                    .status(ConversationStatus.ACTIVE)
                                    .build()
                    );
                });
        return toConversationResponse(conv, customerId);
    }

    public PageResponseDto<ConversationResponseDto> getConversations(UUID userId, String role,
                                                                     int page, int size) {
        boolean isSeller = "SELLER".equalsIgnoreCase(role);
        Page<ChatConversation> convPage = isSeller
                ? conversationRepo.findBySellerId(userId, ConversationStatus.ACTIVE, PageRequest.of(page, size))
                : conversationRepo.findByCustomerId(userId, ConversationStatus.ACTIVE, PageRequest.of(page, size));

        List<ConversationResponseDto> content = convPage.getContent().stream()
                .map(c -> toConversationResponse(c, userId))
                .toList();

        return PageResponseDto.<ConversationResponseDto>builder()
                .content(content).page(page).size(size)
                .totalElements(convPage.getTotalElements())
                .totalPages(convPage.getTotalPages())
                .last(convPage.isLast())
                .build();
    }

    // ─── Message ──────────────────────────────────────────────────

    @Transactional
    public MessageResponseDto sendMessage(UUID senderId, String role, WsSendMessageDto req) {
        ChatConversation conv = conversationRepo.findById(req.getConversationId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation not found: " + req.getConversationId()));

        SenderRole senderRole = resolveSenderRole(senderId, conv);

        if (conv.getStatus() != ConversationStatus.ACTIVE)
            throw new IllegalStateException("Conversation is closed or blocked");

        ChatMessage replyTo = null;
        if (req.getReplyToMessageId() != null) {
            replyTo = messageRepo.findById(req.getReplyToMessageId()).orElse(null);
        }

        ChatMessage saved = messageRepo.save(ChatMessage.builder()
                .conversation(conv)
                .senderId(senderId)
                .senderRole(senderRole)
                .content(req.getContent())
                .messageType(req.getMessageType() != null ? req.getMessageType() : MessageType.TEXT)
                .fileUrl(req.getFileUrl())
                .fileName(req.getFileName())
                .fileSize(req.getFileSize())
                .replyToMessage(replyTo)
                .isRead(false)
                .build());

        log.debug("Message saved: id={} conv={}", saved.getId(), req.getConversationId());
        return toMessageResponse(saved);
    }

    public PageResponseDto<MessageResponseDto> getMessages(Long conversationId,
                                                           UUID currentUserId,
                                                           int page, int size) {
        ChatConversation conv = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        assertParticipant(currentUserId, conv);

        Page<ChatMessage> msgPage =
                messageRepo.findByConversationId(conversationId, PageRequest.of(page, size));

        return PageResponseDto.<MessageResponseDto>builder()
                .content(msgPage.getContent().stream().map(this::toMessageResponse).toList())
                .page(page).size(size)
                .totalElements(msgPage.getTotalElements())
                .totalPages(msgPage.getTotalPages())
                .last(msgPage.isLast())
                .build();
    }

    @Transactional
    public void markAsRead(Long conversationId, UUID currentUserId) {
        messageRepo.markAllAsRead(conversationId, currentUserId);
        log.debug("Mark read: conv={} user={}", conversationId, currentUserId);
    }

    @Transactional
    public Long deleteMessage(Long messageId, UUID currentUserId) {
        ChatMessage msg = messageRepo.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        if (!msg.getSenderId().equals(currentUserId))
            throw new SecurityException("You do not have permission to delete this message");
        msg.setDeleted(true);
        messageRepo.save(msg);
        return msg.getConversation().getId();
    }

    public UnreadCountResponseDto getTotalUnread(UUID userId) {
        return UnreadCountResponseDto.builder()
                .totalUnread(messageRepo.countTotalUnread(userId))
                .build();
    }

    /**
     * Lay ID nguoi con lai trong conversation de gui WS notification.
     */
    public UUID getOtherParticipant(Long conversationId, UUID currentUserId) {
        return conversationRepo.findById(conversationId).map(conv -> {
            if (conv.getCustomerId().equals(currentUserId)) return conv.getSellerId();
            if (conv.getSellerId().equals(currentUserId))   return conv.getCustomerId();
            return null;
        }).orElse(null);
    }

    // ─── Private helpers ──────────────────────────────────────────

    private SenderRole resolveSenderRole(UUID senderId, ChatConversation conv) {
        if (conv.getCustomerId().equals(senderId)) return SenderRole.CUSTOMER;
        if (conv.getSellerId().equals(senderId))   return SenderRole.SELLER;
        throw new SecurityException("User " + senderId + " does not belong to this conversation");
    }

    private void assertParticipant(UUID userId, ChatConversation conv) {
        if (!conv.getCustomerId().equals(userId) && !conv.getSellerId().equals(userId))
            throw new SecurityException("You do not have permission to view this conversation");
    }

    private ConversationResponseDto toConversationResponse(ChatConversation c, UUID currentUserId) {
        long unread = messageRepo.countUnread(c.getId(), currentUserId);
        MessageResponseDto lastMsg = messageRepo
                .findByConversationId(c.getId(), PageRequest.of(0, 1))
                .getContent().stream().map(this::toMessageResponse).findFirst().orElse(null);

        return ConversationResponseDto.builder()
                .id(c.getId()).customerId(c.getCustomerId()).sellerId(c.getSellerId())
                .productId(c.getProductId()).status(c.getStatus())
                .unreadCount(unread).lastMessage(lastMsg)
                .updatedAt(c.getUpdatedAt()).createdAt(c.getCreatedAt())
                .build();
    }

    public MessageResponseDto toMessageResponse(ChatMessage m) {
        MessageResponseDto.ReplyInfo replyInfo = null;
        if (m.getReplyToMessage() != null) {
            ChatMessage r = m.getReplyToMessage();
            replyInfo = MessageResponseDto.ReplyInfo.builder()
                    .id(r.getId())
                    .content(r.getContent())
                    .messageType(r.getMessageType())
                    .fileName(r.getFileName())
                    .senderId(r.getSenderId())
                    .build();
        }

        return MessageResponseDto.builder()
                .id(m.getId())
                .conversationId(m.getConversation().getId())
                .senderId(m.getSenderId())
                .senderRole(m.getSenderRole())
                .content(m.getContent())
                .messageType(m.getMessageType())
                .fileUrl(m.getFileUrl())
                .fileName(m.getFileName())
                .fileSize(m.getFileSize())
                .read(m.isRead())
                .createdAt(m.getCreatedAt())
                .replyToMessage(replyInfo)   // ← thêm dòng này
                .build();
    }
}