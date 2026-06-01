package com.ecommerce.chat.service;

import com.ecommerce.chat.dto.FileUploadResponseDto;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
public class UploadService {

    @Value("${chat.media.upload-directory:uploads/chat-media}")
    private String uploadDir;

    @Value("${app.upload.max-size-bytes:10485760}")
    private long maxSizeBytes;

    @Value("${app.upload.allowed-types:image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/quicktime,video/webm}")
    private List<String> allowedTypes;

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(Paths.get(uploadDir));
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage directory", e);
        }
    }

    public FileUploadResponseDto uploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > maxSizeBytes) {
            throw new IllegalArgumentException("File size exceeds limit of " + maxSizeBytes + " bytes");
        }
        String contentType = file.getContentType();
        if (contentType == null || !allowedTypes.contains(contentType)) {
            throw new IllegalArgumentException("File type " + contentType + " is not allowed");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String newFilename = UUID.randomUUID().toString() + extension;
        Path targetLocation = Paths.get(uploadDir).resolve(newFilename);

        try {
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Could not store file " + newFilename + ". Please try again!", e);
        }

        String fileUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/")
                .path(newFilename)
                .toUriString();

        return FileUploadResponseDto.builder()
                .fileUrl(fileUrl)
                .fileName(originalFilename)
                .fileSize(file.getSize())
                .contentType(contentType)
                .build();
    }
}
