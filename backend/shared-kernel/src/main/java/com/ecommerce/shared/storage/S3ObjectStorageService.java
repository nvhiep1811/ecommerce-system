package com.ecommerce.shared.storage;

import com.ecommerce.shared.web.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;

@Slf4j
@Service
public class S3ObjectStorageService {

    private final S3StorageProperties properties;
    private final S3Client s3Client;

    public S3ObjectStorageService(S3StorageProperties properties, S3Client s3Client) {
        this.properties = properties;
        this.s3Client = s3Client;
    }

    public UploadedObject putObject(String objectKey, byte[] bytes, String contentType) {
        ensureConfigured();
        if (objectKey == null || objectKey.isBlank() || objectKey.startsWith("/") || objectKey.contains("..")) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Object key không hợp lệ");
        }

        try {
            PutObjectRequest.Builder request = PutObjectRequest.builder()
                    .bucket(properties.getBucket())
                    .key(objectKey)
                    .contentType(contentType)
                    .cacheControl(properties.getCacheControl());

            if ("SSE-S3".equalsIgnoreCase(properties.getEncryption())) {
                request.serverSideEncryption(ServerSideEncryption.AES256);
            }

            s3Client.putObject(request.build(), RequestBody.fromBytes(bytes));
            return new UploadedObject(objectKey, publicUrl(objectKey), contentType, bytes == null ? 0L : bytes.length);
        } catch (SdkException exception) {
            log.warn("Failed to upload S3 object {}: {}", objectKey, exception.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Upload tệp lên S3 thất bại");
        }
    }

    public void deleteObjectQuietly(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        if (properties.getBucket() == null || properties.getBucket().isBlank()) {
            log.warn("Skip S3 delete for {} because bucket is not configured", objectKey);
            return;
        }

        try {
            s3Client.deleteObject(builder -> builder.bucket(properties.getBucket()).key(objectKey));
        } catch (SdkException exception) {
            log.warn("Failed to delete S3 object {}: {}", objectKey, exception.getMessage());
        }
    }

    public String publicUrl(String objectKey) {
        ensureCdnConfigured();
        return trimTrailingSlash(properties.getCdnBaseUrl()) + "/" + trimLeadingSlash(objectKey);
    }

    public Optional<String> objectKeyFromCdnUrl(String url) {
        if (url == null || url.isBlank() || !isManagedCdnUrl(url)) {
            return Optional.empty();
        }

        try {
            URI uri = URI.create(url);
            String rawPath = uri.getRawPath();
            if (rawPath == null || rawPath.isBlank() || "/".equals(rawPath)) {
                return Optional.empty();
            }
            String key = URLDecoder.decode(trimLeadingSlash(rawPath), StandardCharsets.UTF_8);
            if (key.isBlank() || key.startsWith("/") || key.contains("..")) {
                return Optional.empty();
            }
            return Optional.of(key);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    public boolean isManagedCdnUrl(String url) {
        if (url == null || url.isBlank() || properties.getCdnBaseUrl() == null || properties.getCdnBaseUrl().isBlank()) {
            return false;
        }

        try {
            URI input = URI.create(url);
            URI configured = URI.create(trimTrailingSlash(properties.getCdnBaseUrl()));
            if (input.getHost() == null || configured.getHost() == null) {
                return false;
            }
            if (!input.getHost().equalsIgnoreCase(configured.getHost())) {
                return false;
            }
            int inputPort = input.getPort();
            int configuredPort = configured.getPort();
            return inputPort == configuredPort;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            return "";
        }
        String normalized = prefix.trim().replace('\\', '/').replaceAll("^/+", "").replaceAll("/+$", "");
        return normalized.isBlank() ? "" : normalized + "/";
    }

    public String joinKey(String prefix, String... parts) {
        String normalizedPrefix = normalizePrefix(prefix);
        String suffix = Arrays.stream(parts == null ? new String[0] : parts)
                .filter(part -> part != null && !part.isBlank())
                .map(this::cleanKeyPart)
                .filter(part -> !part.isBlank())
                .reduce((left, right) -> left + "/" + right)
                .orElse("");
        return normalizedPrefix + suffix;
    }

    private void ensureConfigured() {
        if (properties.getBucket() == null || properties.getBucket().isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "S3 bucket chưa được cấu hình");
        }
        ensureCdnConfigured();
    }

    private void ensureCdnConfigured() {
        if (properties.getCdnBaseUrl() == null || properties.getCdnBaseUrl().isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "CloudFront CDN base URL chưa được cấu hình");
        }
    }

    private String cleanKeyPart(String value) {
        return value.trim()
                .replace('\\', '/')
                .replaceAll("^/+", "")
                .replaceAll("/+$", "")
                .replace("..", "");
    }

    private String trimTrailingSlash(String value) {
        return value.replaceAll("/+$", "");
    }

    private String trimLeadingSlash(String value) {
        return value.replaceAll("^/+", "");
    }
}
