package com.ecommerce.catalog.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class ClientConfig {

    @Bean
    RestClient commerceRestClient(RestClient.Builder builder, @Value("${clients.commerce-service.base-url}") String baseUrl) {
        return builder.baseUrl(baseUrl).build();
    }
}
