package com.ecommerce.catalog.service;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.storage.S3ObjectStorageService;
import com.ecommerce.shared.storage.S3StorageProperties;
import com.ecommerce.shared.web.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
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

    private final S3StorageProperties properties;
    private final S3ObjectStorageService objectStorageService;

    public ProductImageStorageService(S3StorageProperties properties, S3ObjectStorageService objectStorageService) {
        this.properties = properties;
        this.objectStorageService = objectStorageService;
    }

    public UploadedObject uploadProductImage(AuthenticatedUser principal, MultipartFile file) {
        String contentType = validateAndResolveContentType(file);
        String extension = extensionFor(contentType, file.getOriginalFilename());
        String objectKey = productObjectKey(principal.userId(), extension);

        try {
            com.ecommerce.shared.storage.UploadedObject uploadedObject =
                    objectStorageService.putObject(objectKey, file.getBytes(), contentType);
            log.info("Uploaded product image for seller {} to S3 object {}", principal.userId(), uploadedObject.objectKey());
            return new UploadedObject(uploadedObject.objectKey(), uploadedObject.publicUrl());
        } catch (IOException exception) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Không thể đọc file ảnh sản phẩm");
        }
    }

    public void deleteIfManagedProductImageUrl(String imageUrl) {
        managedProductObjectKey(imageUrl).ifPresent(objectStorageService::deleteObjectQuietly);
    }

    public void deleteObjectQuietly(String objectKey) {
        objectStorageService.deleteObjectQuietly(objectKey);
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

    private String productObjectKey(String sellerId, String extension) {
        String dateFolder = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return objectStorageService.joinKey(
                properties.getProductsPrefix(),
                sellerId,
                dateFolder,
                UUID.randomUUID() + "." + extension
        );
    }

    private Optional<String> managedProductObjectKey(String imageUrl) {
        String productsPrefix = objectStorageService.normalizePrefix(properties.getProductsPrefix());
        return objectStorageService.objectKeyFromCdnUrl(imageUrl)
                .filter(objectKey -> objectKey.startsWith(productsPrefix));
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

    public record UploadedObject(String objectPath, String publicUrl) {
    }
}
