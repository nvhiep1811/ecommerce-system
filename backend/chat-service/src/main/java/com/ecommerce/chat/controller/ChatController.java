package com.ecommerce.chat.controller;

import com.ecommerce.chat.dto.ChatConversationCreateRequest;
import com.ecommerce.chat.dto.ChatConversationResponse;
import com.ecommerce.chat.dto.ChatConversationsResponse;
import com.ecommerce.chat.dto.ChatMessageCreateRequest;
import com.ecommerce.chat.dto.ChatMessageResponse;
import com.ecommerce.chat.dto.ChatMessagesResponse;
import com.ecommerce.chat.service.ChatMediaStorageService;
import com.ecommerce.chat.service.ChatService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/chat")
public class ChatController {

    private final ChatService chatService;
    private final ChatMediaStorageService mediaStorageService;

    public ChatController(ChatService chatService, ChatMediaStorageService mediaStorageService) {
        this.chatService = chatService;
        this.mediaStorageService = mediaStorageService;
    }

    @GetMapping("/conversations")
    public ChatConversationsResponse conversations(Authentication authentication) {
        return chatService.getConversations((AuthenticatedUser) authentication.getPrincipal());
    }

    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatConversationResponse conversation(
            Authentication authentication,
            @Valid @RequestBody ChatConversationCreateRequest request
    ) {
        return chatService.getOrCreateConversation((AuthenticatedUser) authentication.getPrincipal(), request.productId());
    }

    @GetMapping("/conversations/{id}")
    public ChatConversationResponse conversation(Authentication authentication, @PathVariable("id") Long id) {
        return chatService.getConversation((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @GetMapping("/conversations/{id}/messages")
    public ChatMessagesResponse messages(Authentication authentication, @PathVariable("id") Long id) {
        return chatService.getMessages((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @PostMapping("/conversations/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatMessageResponse send(
            Authentication authentication,
            @PathVariable("id") Long id,
            @Valid @RequestBody ChatMessageCreateRequest request
    ) {
        return chatService.sendMessage((AuthenticatedUser) authentication.getPrincipal(), id, request.content());
    }

    @PostMapping(value = "/conversations/{id}/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ChatMessageResponse sendMedia(
            Authentication authentication,
            @PathVariable("id") Long id,
            @RequestPart("file") MultipartFile file
    ) {
        ChatMediaStorageService.StoredMedia media = mediaStorageService.store(id, file);
        return chatService.sendMediaMessage((AuthenticatedUser) authentication.getPrincipal(), id, media);
    }

    @PostMapping("/conversations/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(Authentication authentication, @PathVariable("id") Long id) {
        chatService.markConversationRead((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @DeleteMapping("/conversations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(Authentication authentication, @PathVariable("id") Long id) {
        chatService.deleteConversation((AuthenticatedUser) authentication.getPrincipal(), id);
    }
}
