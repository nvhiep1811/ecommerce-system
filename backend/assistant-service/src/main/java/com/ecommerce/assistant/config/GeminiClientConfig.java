package com.ecommerce.assistant.config;

import com.google.genai.Client;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
@RequiredArgsConstructor
public class GeminiClientConfig {

    private final GeminiProperties properties;

    @Bean
    public Client geminiClient() {
        if (!StringUtils.hasText(properties.getApiKey())) {
            // Return null or throw exception based on error handling design.
            // But we can let it be handled later. Let's create an empty client or null.
            return null;
        }
        return Client.builder()
                .apiKey(properties.getApiKey())
                .build();
    }
}
