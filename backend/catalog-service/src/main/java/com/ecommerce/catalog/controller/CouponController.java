package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.CouponValidationRequest;
import com.ecommerce.catalog.dto.CouponValidationResponse;
import com.ecommerce.catalog.service.CatalogService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/catalog/coupons")
public class CouponController {

    private final CatalogService catalogService;

    public CouponController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public List<CouponResponse> list() {
        return catalogService.getCoupons();
    }

    @PostMapping("/validate")
    public CouponValidationResponse validate(@Valid @RequestBody CouponValidationRequest request) {
        return catalogService.validateCoupon(request);
    }
}
