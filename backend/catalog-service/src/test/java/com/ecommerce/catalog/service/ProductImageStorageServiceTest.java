package com.ecommerce.catalog.service;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.storage.S3ObjectStorageService;
import com.ecommerce.shared.storage.S3StorageProperties;
import com.ecommerce.shared.web.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ProductImageStorageServiceTest {

    @Mock
    private S3Client s3Client;

    @Test
    void uploadProductImageStoresImageUnderSellerFolder() {
        S3StorageProperties properties = properties();
        ProductImageStorageService service = service(properties);
        UUID sellerId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "Laptop.PNG", "image/png", new byte[]{1, 2, 3});

        ProductImageStorageService.UploadedObject uploadedObject = service.uploadProductImage(
                new AuthenticatedUser(sellerId.toString(), "seller@example.com", List.of("SELLER")),
                file
        );

        assertTrue(uploadedObject.objectPath().startsWith("products/" + sellerId + "/"));
        assertTrue(uploadedObject.objectPath().endsWith(".png"));
        assertEquals(
                "https://d35ci4s1xmcpe.cloudfront.net/" + uploadedObject.objectPath(),
                uploadedObject.publicUrl()
        );

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));
        PutObjectRequest request = requestCaptor.getValue();
        assertEquals("ecommerce-prod-media-4ss-2026", request.bucket());
        assertEquals(uploadedObject.objectPath(), request.key());
        assertEquals("image/png", request.contentType());
        assertEquals("public, max-age=31536000, immutable", request.cacheControl());
        assertEquals(ServerSideEncryption.AES256, request.serverSideEncryption());
    }

    @Test
    void uploadProductImageRejectsUnsupportedFileType() {
        ProductImageStorageService service = service(properties());
        MockMultipartFile file = new MockMultipartFile("file", "payload.pdf", "application/pdf", new byte[]{1});

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.uploadProductImage(
                        new AuthenticatedUser(UUID.randomUUID().toString(), "seller@example.com", List.of("SELLER")),
                        file
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verifyNoInteractions(s3Client);
    }

    @Test
    void deleteIfManagedProductImageUrlIgnoresExternalImages() {
        ProductImageStorageService service = service(properties());

        service.deleteIfManagedProductImageUrl(
                "https://legacy-cdn.example.com/product-images/products/iphone.jpg"
        );

        verifyNoInteractions(s3Client);
    }

    private ProductImageStorageService service(S3StorageProperties properties) {
        return new ProductImageStorageService(properties, new S3ObjectStorageService(properties, s3Client));
    }

    private S3StorageProperties properties() {
        S3StorageProperties properties = new S3StorageProperties();
        properties.setBucket("ecommerce-prod-media-4ss-2026");
        properties.setRegion("ap-southeast-1");
        properties.setCdnBaseUrl("https://d35ci4s1xmcpe.cloudfront.net");
        properties.setProductsPrefix("products/");
        properties.setMaxProductImageSizeBytes(5 * 1024 * 1024);
        return properties;
    }
}
