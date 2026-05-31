package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.FlashSaleClaimRequest;
import com.ecommerce.commerce.dto.FlashSaleClaimResponse;
import com.ecommerce.commerce.dto.FlashSalePreloadRequest;
import com.ecommerce.commerce.dto.FlashSalePreloadResponse;
import com.ecommerce.commerce.service.FlashSaleService;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class FlashSaleCommandControllerTest {

    @Mock
    private FlashSaleService flashSaleService;

    @InjectMocks
    private FlashSaleCommandController controller;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testPreload() {
        AuthenticatedUser user = new AuthenticatedUser(); // assume a simple constructor
        FlashSalePreloadRequest request = new FlashSalePreloadRequest();
        FlashSalePreloadResponse mockResponse = new FlashSalePreloadResponse();
        when(flashSaleService.preload(any(), any(Long.class), any(Long.class), any()))
                .thenReturn(mockResponse);

        ResponseEntity<FlashSalePreloadResponse> response = controller.preload(user, 1L, 2L, request);
        assertEquals(200, response.getStatusCodeValue());
        assertSame(mockResponse, response.getBody());
    }

    @Test
    void testClaim() {
        AuthenticatedUser user = new AuthenticatedUser();
        FlashSaleClaimRequest request = new FlashSaleClaimRequest();
        FlashSaleClaimResponse mockResponse = new FlashSaleClaimResponse();
        when(flashSaleService.claim(any(), any(Long.class), any(Long.class), any()))
                .thenReturn(mockResponse);

        ResponseEntity<FlashSaleClaimResponse> response = controller.claim(user, 1L, 2L, request);
        assertEquals(200, response.getStatusCodeValue());
        assertSame(mockResponse, response.getBody());
    }
}
