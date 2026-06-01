//package com.ecommerce.catalog.controller;
//
//import com.ecommerce.catalog.dto.CouponResponse;
//import com.ecommerce.catalog.dto.CouponValidationRequest;
//import com.ecommerce.catalog.dto.CouponValidationResponse;
//import com.ecommerce.catalog.dto.CreateCouponRequest;
//import com.ecommerce.catalog.dto.UpdateCouponRequest;
//import com.ecommerce.catalog.service.CatalogService;
//import jakarta.validation.Valid;
//import org.springframework.http.HttpStatus;
//import org.springframework.security.access.prepost.PreAuthorize;
//import org.springframework.web.bind.annotation.DeleteMapping;
//import org.springframework.web.bind.annotation.GetMapping;
//import org.springframework.web.bind.annotation.PathVariable;
//import org.springframework.web.bind.annotation.PostMapping;
//import org.springframework.web.bind.annotation.PutMapping;
//import org.springframework.web.bind.annotation.RequestBody;
//import org.springframework.web.bind.annotation.RequestMapping;
//import org.springframework.web.bind.annotation.ResponseStatus;
//import org.springframework.web.bind.annotation.RestController;
//
//import java.util.List;
//
//@RestController
//@RequestMapping("/catalog/coupons")
//public class CouponController {
//
//    private final CatalogService catalogService;
//
//    public CouponController(CatalogService catalogService) {
//        this.catalogService = catalogService;
//    }
//
//    @GetMapping
//    public List<CouponResponse> list() {
//        return catalogService.getCoupons();
//    }
//
//    @GetMapping("/{id}")
//    public CouponResponse get(@PathVariable Long id) {
//        return catalogService.getCouponById(id);
//    }
//
//    @PostMapping
//    @PreAuthorize("hasRole('SELLER')")
//    @ResponseStatus(HttpStatus.CREATED)
//    public CouponResponse create(@Valid @RequestBody CreateCouponRequest request) {
//        return catalogService.createCoupon(request);
//    }
//
//    @PutMapping("/{id}")
//    @PreAuthorize("hasRole('SELLER')")
//    public CouponResponse update(@PathVariable Long id, @Valid @RequestBody UpdateCouponRequest request) {
//        return catalogService.updateCoupon(id, request);
//    }
//
//    @DeleteMapping("/{id}")
//    @PreAuthorize("hasRole('SELLER')")
//    @ResponseStatus(HttpStatus.NO_CONTENT)
//    public void delete(@PathVariable Long id) {
//        catalogService.deleteCoupon(id);
//    }
//
//    @PostMapping("/validate")
//    public CouponValidationResponse validate(@Valid @RequestBody CouponValidationRequest request) {
//        return catalogService.validateCoupon(request);
//    }
//}
