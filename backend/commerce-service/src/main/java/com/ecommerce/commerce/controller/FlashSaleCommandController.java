package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.FlashSaleClaimRequest;
import com.ecommerce.commerce.dto.FlashSaleClaimResponse;
import com.ecommerce.commerce.dto.FlashSalePreloadRequest;
import com.ecommerce.commerce.dto.FlashSalePreloadResponse;
import com.ecommerce.commerce.service.FlashSaleService;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller handling write‑side commands for flash‑sale operations.
 * This aligns with the CQRS pattern: commands (writes) are separated from queries (reads).
 */
@RestController
@RequestMapping("/api/flashsale/commands")
public class FlashSaleCommandController {

    private final FlashSaleService flashSaleService;

    public FlashSaleCommandController(FlashSaleService flashSaleService) {
        this.flashSaleService = flashSaleService;
    }

    // In a real system the AuthenticatedUser would be resolved from the security context.
    // For simplicity we accept it as a request attribute; Spring can inject it via a custom argument resolver.
    @PostMapping("/{campaignId}/{itemId}/preload")
    public ResponseEntity<FlashSalePreloadResponse> preload(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long campaignId,
            @PathVariable Long itemId,
            @RequestBody FlashSalePreloadRequest request) {
        FlashSalePreloadResponse response = flashSaleService.preload(principal, campaignId, itemId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{campaignId}/{itemId}/claim")
    public ResponseEntity<FlashSaleClaimResponse> claim(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long campaignId,
            @PathVariable Long itemId,
            @RequestBody FlashSaleClaimRequest request) {
        FlashSaleClaimResponse response = flashSaleService.claim(principal, campaignId, itemId, request);
        return ResponseEntity.ok(response);
    }
}
