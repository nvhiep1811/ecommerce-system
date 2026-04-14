package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.InventoryUpsertRequest;
import com.ecommerce.commerce.service.InventoryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/commerce/inventory")
public class InternalInventoryController {

    private final InventoryService inventoryService;

    public InternalInventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping("/upsert")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void upsert(@RequestBody InventoryUpsertRequest request) {
        inventoryService.upsertStock(request);
    }
}
