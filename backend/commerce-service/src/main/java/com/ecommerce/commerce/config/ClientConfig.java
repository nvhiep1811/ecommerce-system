package com.ecommerce.commerce.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class ClientConfig {

    @Bean
    RestClient catalogRestClient(RestClient.Builder builder, @Value("${clients.catalog-service.base-url}") String baseUrl) {
        return builder.baseUrl(baseUrl).build();
    }

    @Bean
    RestClient userRestClient(RestClient.Builder builder, @Value("${clients.user-service.base-url}") String baseUrl) {
        return builder.baseUrl(baseUrl).build();
    }
}
