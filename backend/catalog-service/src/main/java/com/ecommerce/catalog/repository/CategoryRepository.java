package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.CategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<CategoryEntity, Long> {

    List<CategoryEntity> findByParentIdIsNullAndActiveTrueOrderByNameAsc();

    List<CategoryEntity> findByParentIdAndActiveTrueOrderByNameAsc(Long parentId);

    List<CategoryEntity> findByActiveTrueOrderByNameAsc();
}
