package com.ecommerce.chat.dto;

import lombok.*;

/**
 * Trả về sau khi upload file thành công qua POST /api/chat/upload.
 * Client dùng fileUrl để gửi kèm vào tin nhắn qua WebSocket.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FileUploadResponseDto {

    private String fileUrl;       // URL để truy cập file
    private String fileName;      // Tên file gốc (hiển thị cho user)
    private Long   fileSize;      // Bytes
    private String contentType;   // MIME type
}
