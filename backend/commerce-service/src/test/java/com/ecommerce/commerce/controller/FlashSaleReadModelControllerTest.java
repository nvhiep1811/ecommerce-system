package com.ecommerce.commerce.controller;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

class FlashSaleReadModelControllerTest {
    @Test
    void getClaimedQuantity_returnsValue() {
        FlashSaleReadModelService mockService = Mockito.mock(FlashSaleReadModelService.class);
        Mockito.when(mockService.getClaimedQuantity("sale1")).thenReturn(42L);
        FlashSaleReadModelController controller = new FlashSaleReadModelController(mockService);
        ResponseEntity<Long> response = controller.getClaimedQuantity("sale1");
        assertEquals(200, response.getStatusCodeValue());
        assertEquals(42L, response.getBody());
    }

    @Test
    void isEventProcessed_returnsTrue() {
        FlashSaleReadModelService mockService = Mockito.mock(FlashSaleReadModelService.class);
        Mockito.when(mockService.isEventProcessed("sale1", "evt123")).thenReturn(true);
        FlashSaleReadModelController controller = new FlashSaleReadModelController(mockService);
        ResponseEntity<Boolean> response = controller.isEventProcessed("sale1", "evt123");
        assertEquals(200, response.getStatusCodeValue());
        assertTrue(response.getBody());
    }
}
