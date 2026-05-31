package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.service.FlashSaleReadModelService;
import com.ecommerce.commerce.dto.FlashSaleQuantityResponse;
import com.ecommerce.commerce.dto.FlashSaleEventProcessedResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;

/**
 * REST controller exposing flash‑sale read‑model data.
 * Provides endpoints to query claimed quantity and idempotency status of events.
 */
@RestController
@RequestMapping("/api/flashsale")
public class FlashSaleReadModelController {
    private final FlashSaleReadModelService readModelService;

    public FlashSaleReadModelController(FlashSaleReadModelService readModelService) {
        this.readModelService = readModelService;
    }

    /**
     * Get the total claimed quantity for a flash sale.
     * @param saleId the identifier of the flash sale
     * @return the claimed quantity as a JSON number
     */
    @GetMapping("/{saleId}/claimed")
    public ResponseEntity<FlashSaleQuantityResponse> getClaimedQuantity(@PathVariable String saleId) {
        Long qty = readModelService.getClaimedQuantity(saleId);
        FlashSaleQuantityResponse resp = new FlashSaleQuantityResponse(qty, Instant.now().toString());
        return ResponseEntity.ok(resp);
    }

    /**
     * Check whether a specific event has already been processed for a sale (idempotency).
     * @param saleId the flash‑sale identifier
     * @param eventId the event identifier
     * @return true if the event was already processed, false otherwise
     */
    @GetMapping("/{saleId}/event/{eventId}/processed")
    public ResponseEntity<FlashSaleEventProcessedResponse> isEventProcessed(@PathVariable String saleId, @PathVariable String eventId) {
        boolean processed = readModelService.isEventProcessed(saleId, eventId);
        FlashSaleEventProcessedResponse resp = new FlashSaleEventProcessedResponse(processed, Instant.now().toString());
        return ResponseEntity.ok(resp);
    }
}
