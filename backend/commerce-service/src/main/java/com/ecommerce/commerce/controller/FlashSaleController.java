package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.*;
import com.ecommerce.commerce.service.FlashSaleQueryService;
import com.ecommerce.commerce.service.FlashSaleService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/commerce/flash-sales", "/flash-sales"})
public class FlashSaleController {

    private final FlashSaleService flashSaleService;
    private final FlashSaleQueryService flashSaleQueryService;

    public FlashSaleController(FlashSaleService flashSaleService, FlashSaleQueryService flashSaleQueryService) {
        this.flashSaleService = flashSaleService;
        this.flashSaleQueryService = flashSaleQueryService;
    }

    @GetMapping("/active")
    public FlashSaleActiveItemsResponse activeItems(
            @RequestParam(defaultValue = "10") @Min(1) @Max(30) Integer limit
    ) {
        return new FlashSaleActiveItemsResponse(flashSaleQueryService.getActiveItems(limit));
    }

    @GetMapping("/products/{productId}/active")
    public FlashSaleProductItemResponse activeItemForProduct(@PathVariable Long productId) {
        return new FlashSaleProductItemResponse(flashSaleQueryService.getActiveItemForProduct(productId).orElse(null));
    }

    @GetMapping("/{campaignId}/items/{itemId}")
    public FlashSaleProductItemResponse activeItem(
            @PathVariable Long campaignId,
            @PathVariable Long itemId
    ) {
        return new FlashSaleProductItemResponse(flashSaleQueryService.getActiveItem(campaignId, itemId).orElse(null));
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
