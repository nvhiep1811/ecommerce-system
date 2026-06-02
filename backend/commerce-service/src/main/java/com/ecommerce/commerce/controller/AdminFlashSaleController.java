package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.AdminFlashSaleCampaignResponse;
import com.ecommerce.commerce.dto.AdminFlashSaleCreateRequest;
import com.ecommerce.commerce.service.AdminFlashSaleService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/commerce/admin/flash-sales", "/admin/flash-sales"})
public class AdminFlashSaleController {

    private final AdminFlashSaleService adminFlashSaleService;

    public AdminFlashSaleController(AdminFlashSaleService adminFlashSaleService) {
        this.adminFlashSaleService = adminFlashSaleService;
    }

    @GetMapping
    public List<AdminFlashSaleCampaignResponse> list(
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer limit
    ) {
        return adminFlashSaleService.listCampaigns(limit);
    }

    @PostMapping
    public ResponseEntity<AdminFlashSaleCampaignResponse> create(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody AdminFlashSaleCreateRequest request
    ) {
        return ResponseEntity.ok(adminFlashSaleService.createCampaign(principal, request));
    }
}
