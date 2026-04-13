package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.CouponConsumeRequest;
import com.ecommerce.catalog.dto.ProductSnapshotRequest;
import com.ecommerce.catalog.dto.ProductSnapshotResponse;
import com.ecommerce.catalog.service.CatalogService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/internal/catalog")
public class InternalCatalogController {

    private final CatalogService catalogService;

    public InternalCatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @PostMapping("/products/snapshots")
    public List<ProductSnapshotResponse> productSnapshots(@RequestBody ProductSnapshotRequest request) {
        return catalogService.getProductSnapshots(request.productIds());
    }

    @PostMapping("/coupons/consume")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void consume(@RequestBody CouponConsumeRequest request) {
        catalogService.consumeCoupon(request);
    }
}
