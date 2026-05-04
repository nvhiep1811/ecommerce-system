package com.ecommerce.user.service;

import com.ecommerce.shared.web.BusinessException;
import com.ecommerce.user.config.SupabaseStorageProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class SupabaseStorageService {

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

    public SupabaseStorageService(SupabaseStorageProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public UploadedObject uploadAvatar(UUID userId, MultipartFile file) {
        ensureConfigured();
        validateAvatar(file);

        String contentType = normalizeContentType(file.getContentType());
        String extension = extensionFor(contentType, file.getOriginalFilename());
        String objectPath = normalizeFolder(properties.getAvatarFolder())
                + "/" + userId
                + "/" + UUID.randomUUID()
                + "." + extension;

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
                        "Upload avatar lên Supabase thất bại: HTTP " + response.statusCode()
                );
            }
            log.info("Uploaded avatar for user {} to Supabase object {}", userId, objectPath);
            return new UploadedObject(objectPath, publicUrl(objectPath));
        } catch (IOException exception) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Không thể đọc file avatar");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Upload avatar bị gián đoạn");
        }
    }

    public void deleteIfManagedAvatarUrl(String avatarUrl) {
        managedObjectPath(avatarUrl).ifPresent(this::deleteObjectQuietly);
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
            log.info("Deleted old Supabase avatar object {}", objectPath);
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

    private void validateAvatar(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ảnh đại diện");
        }
        if (file.getSize() > properties.getMaxAvatarSizeBytes()) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "Ảnh đại diện vượt quá dung lượng cho phép");
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Avatar chỉ hỗ trợ JPG, PNG, WEBP, HEIC hoặc HEIF");
        }
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

    private Optional<String> managedObjectPath(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) {
            return Optional.empty();
        }
        try {
            URI uri = URI.create(avatarUrl);
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
            String managedFolder = normalizeFolder(properties.getAvatarFolder()) + "/";
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
            return "users/avatars";
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
