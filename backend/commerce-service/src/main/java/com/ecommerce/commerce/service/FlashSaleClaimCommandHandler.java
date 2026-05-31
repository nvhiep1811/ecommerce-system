package com.ecommerce.commerce.service;

import com.ecommerce.commerce.dto.FlashSaleClaimRequest;
import com.ecommerce.commerce.dto.FlashSaleClaimResponse;
import com.ecommerce.commerce.event.FlashSaleClaimedEvent;
import com.ecommerce.commerce.service.FlashSaleClaimCommand;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import java.util.Collections;

@Component
public class FlashSaleClaimCommandHandler {

    private final FlashSaleService flashSaleService;
    private final KafkaTemplate<String, FlashSaleClaimedEvent> kafkaTemplate;

    public FlashSaleClaimCommandHandler(FlashSaleService flashSaleService,
                                         KafkaTemplate<String, FlashSaleClaimedEvent> kafkaTemplate) {
        this.flashSaleService = flashSaleService;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Executes a claim command, updates stock atomically via Redis store and publishes an event.
     */
    public FlashSaleClaimResponse handle(FlashSaleClaimCommand command) {
        AuthenticatedUser principal = new AuthenticatedUser(command.userId().toString(), "unknown@example.com", Collections.emptyList());
        FlashSaleClaimRequest request = new FlashSaleClaimRequest(command.requestId(), command.quantity());
        FlashSaleClaimResponse result = flashSaleService.claim(principal, command.campaignId(), command.itemId(), request);
        if ("RESERVED".equals(result.status())) {
            kafkaTemplate.send("flash-sale-claimed", new FlashSaleClaimedEvent(
                    command.campaignId().toString(),
                    command.userId().toString(),
                    command.quantity()
            ));
        }
        return result;
    }
}
