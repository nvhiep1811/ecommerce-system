package com.ecommerce.chat.controller;

import com.ecommerce.chat.dto.FileUploadResponseDto;
import com.ecommerce.chat.service.UploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;

    @PostMapping("/upload")
    @ResponseStatus(HttpStatus.CREATED)
    public FileUploadResponseDto uploadFile(@RequestParam("file") MultipartFile file) {
        return uploadService.uploadFile(file);
    }
}
