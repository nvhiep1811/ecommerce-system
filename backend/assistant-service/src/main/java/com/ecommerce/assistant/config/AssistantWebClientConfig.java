package com.ecommerce.assistant.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class AssistantWebClientConfig {

    @Value("${services.catalog.url}")
    private String catalogUrl;

    @Value("${services.commerce.url}")
    private String commerceUrl;

    @Bean
    public WebClient catalogWebClient(WebClient.Builder builder) {
        return builder.baseUrl(catalogUrl).build();
    }

    @Bean
    public WebClient commerceWebClient(WebClient.Builder builder) {
        return builder.baseUrl(commerceUrl).build();
    }
}
