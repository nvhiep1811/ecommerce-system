package com.ecommerce.chat.dto;

import lombok.*;

import java.util.List;

/**
 * Wrapper phân trang chuẩn – dùng chung cho mọi danh sách trả về.
 *
 * Ví dụ dùng: PageResponseDto&lt;ConversationResponseDto&gt;
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PageResponseDto<T> {

    private List<T> content;
    private int     page;
    private int     size;
    private long    totalElements;
    private int     totalPages;
    private boolean last;
}
