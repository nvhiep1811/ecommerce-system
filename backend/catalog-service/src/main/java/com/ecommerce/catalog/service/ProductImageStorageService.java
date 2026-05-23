package com.ecommerce.catalog.service;

import com.ecommerce.catalog.config.SupabaseStorageProperties;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class ProductImageStorageService {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
    );

    private final SupabaseStorageProperties properties;
    private final HttpClient httpClient;

    @Autowired
    public ProductImageStorageService(SupabaseStorageProperties properties) {
        this(
                properties,
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(10))
                        .build()
        );
    }

    ProductImageStorageService(SupabaseStorageProperties properties, HttpClient httpClient) {
        this.properties = properties;
        this.httpClient = httpClient;
    }

    public UploadedObject uploadProductImage(AuthenticatedUser principal, MultipartFile file) {
        ensureConfigured();
        String contentType = validateAndResolveContentType(file);
        String extension = extensionFor(contentType, file.getOriginalFilename());
        String objectPath = productObjectPath(principal.userId(), extension);

        try {
            HttpRequest request = baseRequest(storageObjectUri(objectPath))
                    .header("Content-Type", contentType)
                    .header("x-upsert", "false")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BusinessException(
                        HttpStatus.BAD_GATEWAY,
                        "Upload ảnh sản phẩm lên Supabase thất bại: HTTP " + response.statusCode()
                );
            }
            log.info("Uploaded product image for seller {} to Supabase object {}", principal.userId(), objectPath);
            return new UploadedObject(objectPath, publicUrl(objectPath));
        } catch (IOException exception) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Không thể đọc file ảnh sản phẩm");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Upload ảnh sản phẩm bị gián đoạn");
        }
    }

    public void deleteIfManagedProductImageUrl(String imageUrl) {
        managedProductObjectPath(imageUrl).ifPresent(this::deleteObjectQuietly);
    }

    public void deleteObjectQuietly(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return;
        }
        if (properties.getServiceRoleKey() == null || properties.getServiceRoleKey().isBlank()) {
            log.warn("Skip Supabase delete because service role key is not configured");
            return;
        }
        try {
            HttpRequest request = baseRequest(storageObjectUri(objectPath))
                    .DELETE()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 404) {
                log.info("Supabase object {} already absent", objectPath);
                return;
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Failed to delete Supabase object {}: HTTP {}", objectPath, response.statusCode());
                return;
            }
            log.info("Deleted old Supabase product image object {}", objectPath);
        } catch (IOException exception) {
            log.warn("Failed to delete Supabase object {}: {}", objectPath, exception.getMessage());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted while deleting Supabase object {}", objectPath);
        }
    }

    private void ensureConfigured() {
        if (properties.getUrl() == null || properties.getUrl().isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Supabase URL chưa được cấu hình");
        }
        if (properties.getServiceRoleKey() == null || properties.getServiceRoleKey().isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Supabase service role key chưa được cấu hình");
        }
        if (properties.getBucket() == null || properties.getBucket().isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Supabase storage bucket chưa được cấu hình");
        }
    }

    private String validateAndResolveContentType(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ảnh sản phẩm");
        }
        if (file.getSize() > properties.getMaxProductImageSizeBytes()) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "Ảnh sản phẩm vượt quá dung lượng cho phép");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (contentType.isBlank()) {
            contentType = contentTypeFromFilename(file.getOriginalFilename()).orElse("");
        }
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Ảnh sản phẩm chỉ hỗ trợ JPG, PNG, WEBP, HEIC hoặc HEIF");
        }
        return contentType;
    }

    private String productObjectPath(String sellerId, String extension) {
        String dateFolder = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return normalizeFolder(properties.getProductFolder())
                + "/"
                + sellerId
                + "/"
                + dateFolder
                + "/"
                + UUID.randomUUID()
                + "."
                + extension;
    }

    private HttpRequest.Builder baseRequest(URI uri) {
        return HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(30))
                .header("apikey", properties.getServiceRoleKey())
                .header("Authorization", "Bearer " + properties.getServiceRoleKey());
    }

    private URI storageObjectUri(String objectPath) {
        return URI.create(baseUrl()
                + "/storage/v1/object/"
                + encodePathSegment(properties.getBucket())
                + "/"
                + encodeObjectPath(objectPath));
    }

    private String publicUrl(String objectPath) {
        return baseUrl()
                + "/storage/v1/object/public/"
                + encodePathSegment(properties.getBucket())
                + "/"
                + encodeObjectPath(objectPath);
    }

    private Optional<String> managedProductObjectPath(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return Optional.empty();
        }
        try {
            URI uri = URI.create(imageUrl);
            URI configuredBase = URI.create(baseUrl());
            if (configuredBase.getHost() == null
                    || uri.getHost() == null
                    || !configuredBase.getHost().equalsIgnoreCase(uri.getHost())) {
                return Optional.empty();
            }

            String marker = "/storage/v1/object/public/" + properties.getBucket() + "/";
            String rawPath = uri.getRawPath();
            if (!rawPath.startsWith(marker)) {
                return Optional.empty();
            }

            String decodedObjectPath = URLDecoder.decode(rawPath.substring(marker.length()), StandardCharsets.UTF_8);
            String managedFolder = normalizeFolder(properties.getProductFolder()) + "/";
            if (!decodedObjectPath.startsWith(managedFolder)) {
                return Optional.empty();
            }
            return Optional.of(decodedObjectPath);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private String baseUrl() {
        return properties.getUrl().replaceAll("/+$", "");
    }

    private String normalizeFolder(String folder) {
        if (folder == null || folder.isBlank()) {
            return "products";
        }
        return folder.replaceAll("^/+|/+$", "");
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
    }

    private String extensionFor(String contentType, String originalFilename) {
        return switch (contentType) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/heic" -> "heic";
            case "image/heif" -> "heif";
            default -> extensionFromName(originalFilename).orElse("jpg");
        };
    }

    private Optional<String> contentTypeFromFilename(String originalFilename) {
        return extensionFromName(originalFilename).map(extension -> switch (extension) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "heic" -> "image/heic";
            case "heif" -> "image/heif";
            default -> "";
        }).filter(value -> !value.isBlank());
    }

    private Optional<String> extensionFromName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return Optional.empty();
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalFilename.length() - 1) {
            return Optional.empty();
        }
        String extension = originalFilename.substring(dotIndex + 1)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
        return extension.isBlank() ? Optional.empty() : Optional.of(extension);
    }

    private String encodeObjectPath(String objectPath) {
        String[] segments = objectPath.split("/");
        StringBuilder encoded = new StringBuilder();
        for (int index = 0; index < segments.length; index++) {
            if (index > 0) {
                encoded.append('/');
            }
            encoded.append(encodePathSegment(segments[index]));
        }
        return encoded.toString();
    }

    private String encodePathSegment(String segment) {
        return URLEncoder.encode(segment, StandardCharsets.UTF_8)
                .replace("+", "%20");
    }

    public record UploadedObject(String objectPath, String publicUrl) {
    }
}
