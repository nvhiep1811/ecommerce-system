package com.ecommerce.catalog.service;

import com.ecommerce.catalog.domain.CategoryEntity;
import com.ecommerce.catalog.dto.CategoryRequest;
import com.ecommerce.catalog.dto.CategoryResponse;
import com.ecommerce.catalog.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategories(Long parentId) {
        List<CategoryEntity> categories = parentId == null
                ? categoryRepository.findByParentIdIsNullAndActiveTrueOrderByNameAsc()
                : categoryRepository.findByParentIdAndActiveTrueOrderByNameAsc(parentId);

        return categories.stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(Long id) {
        CategoryEntity entity = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found with id: " + id));
        return mapToResponse(entity);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getAllCategories() {
        return categoryRepository.findByActiveTrueOrderByNameAsc()
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        CategoryEntity entity = new CategoryEntity();

        entity.setParentId(request.parentId());
        entity.setName(request.name());

        // ⚠️ THÊM LOGIC AUTO-GENERATE SLUG
        String slug = (request.slug() == null || request.slug().isBlank())
                ? generateSlug(request.name())
                : request.slug();
        entity.setSlug(slug);

        entity.setDescription(request.description());
        entity.setImageUrl(request.imageUrl());
        entity.setActive(request.active() == null ? true : request.active());

        CategoryEntity savedEntity = categoryRepository.save(entity);
        return mapToResponse(savedEntity);
    }

    @Transactional
    public CategoryResponse updateCategory(Long id, CategoryRequest request) {
        CategoryEntity entity = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found with id: " + id));

        entity.setParentId(request.parentId());
        entity.setName(request.name());

        // ⚠️ THÊM LOGIC AUTO-GENERATE SLUG KHI UPDATE
        String slug = (request.slug() == null || request.slug().isBlank())
                ? generateSlug(request.name())
                : request.slug();
        entity.setSlug(slug);

        entity.setDescription(request.description());
        entity.setImageUrl(request.imageUrl());
        entity.setActive(request.active() == null ? true : request.active());

        CategoryEntity updatedEntity = categoryRepository.save(entity);
        return mapToResponse(updatedEntity);
    }

    @Transactional
    public void deleteCategory(Long id) {
        CategoryEntity entity = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found with id: " + id));

        categoryRepository.delete(entity);
    }

    private CategoryResponse mapToResponse(CategoryEntity entity) {
        return new CategoryResponse(
                entity.getId(),
                entity.getParentId(),
                entity.getName()
        );
    }

    private String generateSlug(String input) {
        if (input == null || input.isBlank()) return "";

        // Bỏ dấu tiếng Việt (ví dụ: Dụng cụ bếp -> Dung cu bep)
        String temp = Normalizer.normalize(input, Normalizer.Form.NFD);
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        String normalized = pattern.matcher(temp).replaceAll("").replace('đ', 'd').replace('Đ', 'D');

        // Chuyển thành chữ thường, thay khoảng trắng bằng dấu gạch ngang
        return normalized.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "") // Bỏ ký tự đặc biệt
                .replaceAll("\\s+", "-")         // Đổi khoảng trắng thành gạch ngang
                .replaceAll("-+", "-")           // Xoá gạch ngang bị trùng (ví dụ: --)
                .replaceAll("^-|-$", "");        // Xoá gạch ngang ở đầu và cuối chuỗi
    }
}