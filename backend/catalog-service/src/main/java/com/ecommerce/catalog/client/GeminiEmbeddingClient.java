package com.ecommerce.catalog.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class GeminiEmbeddingClient {

    private final RestClient restClient;
    private final String apiKey;

    public GeminiEmbeddingClient(@Value("${GEMINI_API_KEY:}") String apiKey) {
        this.apiKey = apiKey;
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .build();
    }

    @SuppressWarnings("unchecked")
    public List<Double> getEmbedding(String text) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Gemini API key is not configured; returning empty embedding");
            return List.of();
        }
        if (text == null || text.isBlank()) {
            return List.of();
        }

        try {
            Map<String, Object> request = Map.of(
                    "model", "models/gemini-embedding-001",
                    "content", Map.of(
                            "parts", List.of(
                                    Map.of("text", text)
                            )
                    )
            );

            Map<String, Object> response = restClient.post()
                    .uri("/models/gemini-embedding-001:embedContent?key=" + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("embedding")) {
                Map<String, Object> embeddingNode = (Map<String, Object>) response.get("embedding");
                if (embeddingNode != null && embeddingNode.containsKey("values")) {
                    List<Number> values = (List<Number>) embeddingNode.get("values");
                    return values.stream().map(Number::doubleValue).toList();
                }
            }

            log.warn("Failed to extract embedding from response: {}", response);
            return List.of();
        } catch (Exception e) {
            log.error("Error generating embedding from Gemini API", e);
            return List.of();
        }
    }
}
