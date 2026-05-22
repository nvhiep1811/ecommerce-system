package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.FlashSaleClaimRequest;
import com.ecommerce.commerce.dto.FlashSaleClaimResponse;
import com.ecommerce.commerce.dto.FlashSalePreloadRequest;
import com.ecommerce.commerce.dto.FlashSalePreloadResponse;
import com.ecommerce.commerce.service.FlashSaleService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/commerce/flash-sales", "/flash-sales"})
public class FlashSaleController {

    private final FlashSaleService flashSaleService;

    public FlashSaleController(FlashSaleService flashSaleService) {
        this.flashSaleService = flashSaleService;
    }

    @PostMapping("/{campaignId}/items/{itemId}/preload")
    public FlashSalePreloadResponse preload(
            Authentication authentication,
            @PathVariable Long campaignId,
            @PathVariable Long itemId,
            @Valid @RequestBody FlashSalePreloadRequest request
    ) {
        return flashSaleService.preload((AuthenticatedUser) authentication.getPrincipal(), campaignId, itemId, request);
    }

    @PostMapping("/{campaignId}/items/{itemId}/claim")
    public FlashSaleClaimResponse claim(
            Authentication authentication,
            @PathVariable Long campaignId,
            @PathVariable Long itemId,
            @Valid @RequestBody FlashSaleClaimRequest request
    ) {
        return flashSaleService.claim((AuthenticatedUser) authentication.getPrincipal(), campaignId, itemId, request);
    }
}
