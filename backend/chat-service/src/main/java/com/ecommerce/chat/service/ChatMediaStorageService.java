package com.ecommerce.chat.service;

import com.ecommerce.shared.web.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ChatMediaStorageService {

    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> VIDEO_TYPES = Set.of("video/mp4", "video/quicktime", "video/webm");

    private final Path uploadDirectory;
    private final long maxImageSizeBytes;
    private final long maxVideoSizeBytes;

    public ChatMediaStorageService(
            @Value("${chat.media.upload-directory:uploads/chat-media}") String uploadDirectory,
            @Value("${chat.media.max-image-size-bytes:5242880}") long maxImageSizeBytes,
            @Value("${chat.media.max-video-size-bytes:52428800}") long maxVideoSizeBytes
    ) {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
        this.maxImageSizeBytes = maxImageSizeBytes;
        this.maxVideoSizeBytes = maxVideoSizeBytes;
    }

    public StoredMedia store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Vui lòng chọn tệp cần gửi");
        }

        String contentType = normalizeContentType(file.getContentType());
        String messageType = resolveMessageType(contentType);
        long maxSize = "IMAGE".equals(messageType) ? maxImageSizeBytes : maxVideoSizeBytes;
        if (file.getSize() > maxSize) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Tệp vượt quá dung lượng cho phép");
        }

        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "chat-media" : file.getOriginalFilename());
        String extension = extensionFrom(originalName, contentType);
        String storedName = UUID.randomUUID() + extension;
        Path target = uploadDirectory.resolve(storedName).normalize();
        if (!target.startsWith(uploadDirectory)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Tên tệp không hợp lệ");
        }

        try {
            Files.createDirectories(uploadDirectory);
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu tệp chat");
        }

        return new StoredMedia(
                "/api/chat/media/" + storedName,
                originalName,
                file.getSize(),
                messageType,
                contentType
        );
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

    private static String extensionFrom(String fileName, String contentType) {
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot >= 0 && lastDot < fileName.length() - 1) {
            return fileName.substring(lastDot).toLowerCase(Locale.ROOT);
        }

        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            case "video/mp4" -> ".mp4";
            case "video/quicktime" -> ".mov";
            case "video/webm" -> ".webm";
            default -> ".jpg";
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
