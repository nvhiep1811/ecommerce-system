package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.ShippingMethodRequest;
import com.ecommerce.commerce.dto.ShippingMethodResponse;
import com.ecommerce.commerce.dto.ShippingMethodsResponse;
import com.ecommerce.commerce.service.ShippingMethodService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/shipping-methods", "/commerce/shipping-methods"}) // Áp dụng cho toàn bộ class
public class ShippingMethodController {

    private final ShippingMethodService shippingMethodService;

    public ShippingMethodController(ShippingMethodService shippingMethodService) {
        this.shippingMethodService = shippingMethodService;
    }

    @GetMapping
    public ShippingMethodsResponse listMethods() {
        return shippingMethodService.listMethods();
    }

    @PostMapping
    public ShippingMethodResponse create(@Valid @RequestBody ShippingMethodRequest request) {
        return shippingMethodService.createShippingMethod(request);
    }

    @PutMapping("/{id}")
    public ShippingMethodResponse update(@PathVariable Long id, @Valid @RequestBody ShippingMethodRequest request) {
        return shippingMethodService.updateShippingMethod(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        shippingMethodService.deleteShippingMethod(id);
    }
}