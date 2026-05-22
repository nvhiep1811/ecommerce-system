package com.ecommerce.chat.controller;

import com.ecommerce.chat.dto.ConversationResponseDto;
import com.ecommerce.chat.dto.MessageResponseDto;
import com.ecommerce.chat.dto.PageResponseDto;
import com.ecommerce.chat.dto.StartConversationRequestDto;
import com.ecommerce.chat.dto.UnreadCountResponseDto;
import com.ecommerce.chat.service.ChatService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponseDto startConversation(
            Authentication authentication,
            @Valid @RequestBody StartConversationRequestDto req) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        UUID customerId = UUID.fromString(principal.userId());
        return chatService.getOrCreateConversation(customerId, req);
    }

    @GetMapping("/conversations")
    public PageResponseDto<ConversationResponseDto> getConversations(
            Authentication authentication,
            @RequestParam(name = "role", defaultValue = "CUSTOMER") String role,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        UUID userId = UUID.fromString(principal.userId());
        return chatService.getConversations(userId, role, page, size);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public PageResponseDto<MessageResponseDto> getMessages(
            Authentication authentication,
            @PathVariable(name = "conversationId") Long conversationId,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "30") int size) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        UUID userId = UUID.fromString(principal.userId());
        return chatService.getMessages(conversationId, userId, page, size);
    }

    @PutMapping("/conversations/{conversationId}/read")
    public ResponseEntity<Void> markAsRead(
            Authentication authentication,
            @PathVariable(name = "conversationId") Long conversationId) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        UUID userId = UUID.fromString(principal.userId());
        chatService.markAsRead(conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            Authentication authentication,
            @PathVariable(name = "messageId") Long messageId) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        UUID userId = UUID.fromString(principal.userId());
        chatService.deleteMessage(messageId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/unread")
    public UnreadCountResponseDto getTotalUnread(Authentication authentication) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        UUID userId = UUID.fromString(principal.userId());
        return chatService.getTotalUnread(userId);
    }
}
