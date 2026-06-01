package com.ecommerce.chat.service;

import com.ecommerce.shared.storage.S3ObjectStorageService;
import com.ecommerce.shared.storage.S3StorageProperties;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class ChatMediaStorageService {

    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> VIDEO_TYPES = Set.of("video/mp4", "video/quicktime", "video/webm");

    private final Path uploadDirectory;
    private final S3StorageProperties properties;
    private final S3ObjectStorageService objectStorageService;

    public ChatMediaStorageService(
            @Value("${chat.media.upload-directory:uploads/chat-media}") String uploadDirectory,
            S3StorageProperties properties,
            S3ObjectStorageService objectStorageService
    ) {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
        this.properties = properties;
        this.objectStorageService = objectStorageService;
    }

    public StoredMedia store(Long conversationId, MultipartFile file) {
        if (conversationId == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Cuộc trò chuyện không hợp lệ");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Vui lòng chọn tệp cần gửi");
        }

        String contentType = normalizeContentType(file.getContentType());
        String messageType = resolveMessageType(contentType);
        long maxSize = "IMAGE".equals(messageType)
                ? properties.getMaxChatImageSizeBytes()
                : properties.getMaxChatVideoSizeBytes();
        if (file.getSize() > maxSize) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Tệp vượt quá dung lượng cho phép");
        }

        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "chat-media" : file.getOriginalFilename());
        String objectKey = chatMediaObjectKey(conversationId, extensionFor(contentType));

        try {
            com.ecommerce.shared.storage.UploadedObject uploadedObject =
                    objectStorageService.putObject(objectKey, file.getBytes(), contentType);
            return new StoredMedia(
                    uploadedObject.publicUrl(),
                    originalName,
                    file.getSize(),
                    messageType,
                    contentType
            );
        } catch (IOException exception) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Không thể đọc tệp chat");
        }
    }

    public Path resolveForRead(String fileName) {
        String cleanName = StringUtils.cleanPath(fileName == null ? "" : fileName);
        Path target = uploadDirectory.resolve(cleanName).normalize();
        if (cleanName.isBlank() || !target.startsWith(uploadDirectory) || !Files.exists(target)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp chat");
        }
        return target;
    }

    public void deleteQuietly(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) {
            return;
        }

        managedChatMediaObjectKey(publicUrl).ifPresent(objectStorageService::deleteObjectQuietly);
        deleteLocalMediaQuietly(publicUrl);
    }

    private String chatMediaObjectKey(Long conversationId, String extension) {
        String dateFolder = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return objectStorageService.joinKey(
                properties.getChatMediaPrefix(),
                conversationId.toString(),
                dateFolder,
                UUID.randomUUID() + extension
        );
    }

    private Optional<String> managedChatMediaObjectKey(String publicUrl) {
        String chatMediaPrefix = objectStorageService.normalizePrefix(properties.getChatMediaPrefix());
        return objectStorageService.objectKeyFromCdnUrl(publicUrl)
                .filter(objectKey -> objectKey.startsWith(chatMediaPrefix));
    }

    private void deleteLocalMediaQuietly(String publicUrl) {
        String marker = "/api/chat/media/";
        int markerIndex = publicUrl.indexOf(marker);
        if (markerIndex < 0) {
            return;
        }

        String fileName = publicUrl.substring(markerIndex + marker.length());
        int queryIndex = fileName.indexOf('?');
        if (queryIndex >= 0) {
            fileName = fileName.substring(0, queryIndex);
        }

        try {
            Files.deleteIfExists(resolveForRead(fileName));
        } catch (Exception ignored) {
        }
    }

    private String resolveMessageType(String contentType) {
        if (IMAGE_TYPES.contains(contentType)) {
            return "IMAGE";
        }
        if (VIDEO_TYPES.contains(contentType)) {
            return "FILE";
        }
        throw new BusinessException(HttpStatus.BAD_REQUEST, "Chỉ hỗ trợ gửi ảnh hoặc video");
    }

    private static String normalizeContentType(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
    }

    private static String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            case "video/mp4" -> ".mp4";
            case "video/quicktime" -> ".mov";
            case "video/webm" -> ".webm";
            default -> ".bin";
        };
    }

    public record StoredMedia(
            String publicUrl,
            String fileName,
            long fileSize,
            String messageType,
            String contentType
    ) {
    }
}
