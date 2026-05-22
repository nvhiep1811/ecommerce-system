package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class FlashSaleQueryServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private FlashSaleProperties properties;
    private FlashSaleQueryService flashSaleQueryService;

    @BeforeEach
    void setUp() {
        properties = new FlashSaleProperties();
        properties.setEnabled(false);
        flashSaleQueryService = new FlashSaleQueryService(jdbcTemplate, properties);
    }

    @Test
    void getActiveItemsShouldReturnEmptyWhenFlashSaleIsDisabled() {
        assertTrue(flashSaleQueryService.getActiveItems(10).isEmpty());
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void getActiveItemForProductShouldReturnEmptyWhenFlashSaleIsDisabled() {
        assertTrue(flashSaleQueryService.getActiveItemForProduct(99L).isEmpty());
        verifyNoInteractions(jdbcTemplate);
    }
}
