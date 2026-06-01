package com.ecommerce.catalog.command;

import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.web.multipart.MultipartFile;

public record UploadProductImageCommand(
        AuthenticatedUser principal,
        MultipartFile file
) {
}
