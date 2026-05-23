package com.ecommerce.assistant.client;

import com.ecommerce.assistant.client.dto.ClientDtos.OrderQuoteRequest;
import com.ecommerce.assistant.client.dto.ClientDtos.OrderQuoteResponse;
import com.ecommerce.assistant.client.dto.ClientDtos.OrderResponse;
import com.ecommerce.assistant.client.dto.ClientDtos.PaymentStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

@Component
@RequiredArgsConstructor
public class CommerceClient {

    private final WebClient commerceWebClient;

    public List<OrderResponse> getMyOrders(String authorizationHeader, String status) {
        return commerceWebClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/api/orders/mine");
                    if (status != null && !status.isEmpty()) {
                        uriBuilder.queryParam("status", status);
                    }
                    return uriBuilder.build();
                })
                .header("Authorization", authorizationHeader)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<OrderResponse>>() {})
                .block();
    }

    public OrderResponse getOrderDetail(String authorizationHeader, Long orderId) {
        return commerceWebClient.get()
                .uri("/api/orders/{id}", orderId)
                .header("Authorization", authorizationHeader)
                .retrieve()
                .bodyToMono(OrderResponse.class)
                .block();
    }

    public PaymentStatusResponse getPaymentStatus(String authorizationHeader, Long orderId) {
        return commerceWebClient.get()
                .uri("/api/orders/{id}/payment-status", orderId)
                .header("Authorization", authorizationHeader)
                .retrieve()
                .bodyToMono(PaymentStatusResponse.class)
                .block();
    }

    public OrderQuoteResponse quoteOrder(String authorizationHeader, OrderQuoteRequest request) {
        return commerceWebClient.post()
                .uri("/api/orders/quote")
                .header("Authorization", authorizationHeader)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(OrderQuoteResponse.class)
                .block();
    }
}
