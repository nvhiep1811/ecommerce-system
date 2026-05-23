package com.ecommerce.assistant.client;

import com.ecommerce.assistant.client.dto.ClientDtos.ProductPageResponse;
import com.ecommerce.assistant.client.dto.ClientDtos.ProductResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class CatalogClient {

    private final WebClient catalogWebClient;

    public ProductPageResponse searchProducts(String search, Long categoryId, Boolean featured, Integer page, Integer size, String sort, String direction) {
        return catalogWebClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/api/catalog/products/page");
                    if (search != null) uriBuilder.queryParam("search", search);
                    if (categoryId != null) uriBuilder.queryParam("categoryId", categoryId);
                    if (featured != null) uriBuilder.queryParam("featured", featured);
                    uriBuilder.queryParam("page", page != null ? page : 0);
                    uriBuilder.queryParam("size", size != null ? size : 5);
                    uriBuilder.queryParam("sort", sort != null ? sort : "createdAt");
                    uriBuilder.queryParam("direction", direction != null ? direction : "DESC");
                    return uriBuilder.build();
                })
                .retrieve()
                .bodyToMono(ProductPageResponse.class)
                .block();
    }

    public ProductResponse getProduct(Long productId) {
        return catalogWebClient.get()
                .uri("/api/catalog/products/{id}", productId)
                .retrieve()
                .bodyToMono(ProductResponse.class)
                .block();
    }
}
