package com.ecommerce.catalog.service;

import com.ecommerce.catalog.config.SupabaseStorageProperties;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductImageStorageServiceTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    @Test
    void uploadProductImageStoresImageUnderSellerFolder() throws Exception {
        SupabaseStorageProperties properties = properties();
        ProductImageStorageService service = new ProductImageStorageService(properties, httpClient);
        UUID sellerId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "Laptop.PNG", "image/png", new byte[]{1, 2, 3});

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpClient.send(
                any(HttpRequest.class),
                org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()
        )).thenReturn(httpResponse);

        ProductImageStorageService.UploadedObject uploadedObject = service.uploadProductImage(
                new AuthenticatedUser(sellerId.toString(), "seller@example.com", List.of("SELLER")),
                file
        );

        assertTrue(uploadedObject.objectPath().startsWith("products/" + sellerId + "/"));
        assertTrue(uploadedObject.objectPath().endsWith(".png"));
        assertEquals(
                "https://project.supabase.co/storage/v1/object/public/product-images/" + uploadedObject.objectPath(),
                uploadedObject.publicUrl()
        );

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(
                requestCaptor.capture(),
                org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any()
        );
        assertEquals("POST", requestCaptor.getValue().method());
        assertEquals("image/png", requestCaptor.getValue().headers().firstValue("Content-Type").orElse(""));
    }

    @Test
    void uploadProductImageRejectsUnsupportedFileType() {
        ProductImageStorageService service = new ProductImageStorageService(properties(), httpClient);
        MockMultipartFile file = new MockMultipartFile("file", "payload.pdf", "application/pdf", new byte[]{1});

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.uploadProductImage(
                        new AuthenticatedUser(UUID.randomUUID().toString(), "seller@example.com", List.of("SELLER")),
                        file
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verifyNoInteractions(httpClient);
    }

    @Test
    void deleteIfManagedProductImageUrlIgnoresSeedImages() {
        ProductImageStorageService service = new ProductImageStorageService(properties(), httpClient);

        service.deleteIfManagedProductImageUrl(
                "https://project.supabase.co/storage/v1/object/public/product-images/seed/products/iphone.jpg"
        );

        verifyNoInteractions(httpClient);
    }

    private SupabaseStorageProperties properties() {
        SupabaseStorageProperties properties = new SupabaseStorageProperties();
        properties.setUrl("https://project.supabase.co");
        properties.setServiceRoleKey("service-role-key");
        properties.setBucket("product-images");
        properties.setProductFolder("products");
        properties.setMaxProductImageSizeBytes(5 * 1024 * 1024);
        return properties;
    }
}
