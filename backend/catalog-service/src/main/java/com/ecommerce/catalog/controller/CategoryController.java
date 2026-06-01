//package com.ecommerce.catalog.controller;
//
//import com.ecommerce.catalog.dto.CategoryRequest;
//import com.ecommerce.catalog.dto.CategoryResponse;
//import com.ecommerce.catalog.service.CategoryService;
//import org.springframework.http.HttpStatus;
//import org.springframework.web.bind.annotation.*;
//
//import java.util.List;
//
//@RestController
//@RequestMapping("/catalog/categories")
//public class CategoryController {
//
//    private final CategoryService categoryService;
//
//    public CategoryController(CategoryService categoryService) {
//        this.categoryService = categoryService;
//    }
//
//    // 1. API Lấy danh sách (GET ALL)
//    @GetMapping
//    public List<CategoryResponse> list(
//            @RequestParam(name = "parentId", required = false) Long parentId,
//            @RequestParam(name = "all", required = false, defaultValue = "false") boolean all
//    ) {
//        if (all) {
//            return categoryService.getAllCategories();
//        }
//        return categoryService.getCategories(parentId);
//    }
//
//    // 2. API Lấy chi tiết 1 danh mục (GET BY ID) -> Phục vụ cho chức năng "Sửa" trên UI
//    @GetMapping("/{id}")
//    public CategoryResponse getById(@PathVariable Long id) {
//        return categoryService.getCategoryById(id);
//    }
//
//    // 3. API Thêm mới (CREATE)
//    @PostMapping
//    @ResponseStatus(HttpStatus.CREATED) // Trả về HTTP 201
//    public CategoryResponse create(@RequestBody CategoryRequest request) {
//        return categoryService.createCategory(request);
//    }
//
//    // 4. API Cập nhật (UPDATE)
//    @PutMapping("/{id}")
//    public CategoryResponse update(@PathVariable Long id, @RequestBody CategoryRequest request) {
//        return categoryService.updateCategory(id, request);
//    }
//
//    // 5. API Xoá (DELETE)
//    @DeleteMapping("/{id}")
//    @ResponseStatus(HttpStatus.NO_CONTENT) // Trả về HTTP 204
//    public void delete(@PathVariable Long id) {
//        categoryService.deleteCategory(id);
//    }
//}