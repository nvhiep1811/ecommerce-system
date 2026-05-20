package com.ecommerce.gateway;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class GatewayRateLimitFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(GatewayRateLimitFilter.class);

    private static final String STORE_LOCAL = "local";
    private static final String STORE_REDIS = "redis";
    private static final String STORE_AUTO = "auto";
    private static final Duration WINDOW = Duration.ofMinutes(1);

    private final GatewayRateLimitProperties properties;
    private final ReactiveStringRedisTemplate redisTemplate;
    private final ConcurrentMap<String, LocalCounter> localCounters = new ConcurrentHashMap<>();

    public GatewayRateLimitFilter(
            GatewayRateLimitProperties properties,
            ObjectProvider<ReactiveStringRedisTemplate> redisTemplateProvider
    ) {
        this.properties = properties;
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (!properties.isEnabled() || isExcluded(exchange)) {
            return chain.filter(exchange);
        }

        String key = key(exchange);
        if (shouldUseRedis()) {
            return checkRedisLimit(key)
                    .flatMap(allowed -> allowed ? chain.filter(exchange) : reject(exchange))
                    .onErrorResume(exception -> {
                        log.warn("Gateway Redis rate limiter unavailable; falling back to local limiter");
                        return checkLocalLimit(key) ? chain.filter(exchange) : reject(exchange);
                    });
        }

        return checkLocalLimit(key) ? chain.filter(exchange) : reject(exchange);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }

    private Mono<Boolean> checkRedisLimit(String key) {
        String redisKey = "gateway:rate-limit:" + currentWindow() + ":" + key;
        return redisTemplate.opsForValue().increment(redisKey)
                .flatMap(count -> {
                    Mono<Boolean> expire = count == 1
                            ? redisTemplate.expire(redisKey, WINDOW.plusSeconds(5))
                            : Mono.just(true);
                    return expire.thenReturn(count <= limit());
                });
    }

    private boolean checkLocalLimit(String key) {
        long now = System.currentTimeMillis();
        long resetAt = now + WINDOW.toMillis();
        LocalCounter counter = localCounters.compute(key, (ignored, current) -> {
            if (current == null || current.resetAtMillis() <= now) {
                return new LocalCounter(1, resetAt);
            }
            return new LocalCounter(current.count() + 1, current.resetAtMillis());
        });
        return counter.count() <= limit();
    }

    private Mono<Void> reject(ServerWebExchange exchange) {
        var response = exchange.getResponse();
        response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] bytes = "{\"message\":\"Too many requests\"}".getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = response.bufferFactory().wrap(bytes);
        return response.writeWith(Mono.just(buffer));
    }

    private boolean shouldUseRedis() {
        String store = store();
        return redisTemplate != null && (STORE_REDIS.equals(store) || STORE_AUTO.equals(store));
    }

    private boolean isExcluded(ServerWebExchange exchange) {
        String path = path(exchange);
        return properties.getExcludedPrefixes().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(prefix -> !prefix.isBlank())
                .anyMatch(path::startsWith);
    }

    private String key(ServerWebExchange exchange) {
        return clientIp(exchange) + ":" + routeBucket(exchange);
    }

    private String clientIp(ServerWebExchange exchange) {
        String forwardedFor = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        if (remoteAddress == null || remoteAddress.getAddress() == null) {
            return "unknown";
        }
        return remoteAddress.getAddress().getHostAddress();
    }

    private String routeBucket(ServerWebExchange exchange) {
        if (!properties.isIncludePathInKey()) {
            return "global";
        }

        String path = path(exchange);
        String[] parts = path.split("/");
        if (parts.length >= 3) {
            return "/" + parts[1] + "/" + parts[2];
        }
        return path;
    }

    private String path(ServerWebExchange exchange) {
        return exchange.getRequest().getPath().pathWithinApplication().value();
    }

    private long currentWindow() {
        return System.currentTimeMillis() / WINDOW.toMillis();
    }

    private int limit() {
        return Math.max(1, properties.getRequestsPerMinute());
    }

    private String store() {
        String value = properties.getStore();
        if (value == null || value.isBlank()) {
            return STORE_AUTO;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (STORE_LOCAL.equals(normalized) || STORE_REDIS.equals(normalized) || STORE_AUTO.equals(normalized)) {
            return normalized;
        }
        return STORE_AUTO;
    }

    private record LocalCounter(int count, long resetAtMillis) {
    }
}
