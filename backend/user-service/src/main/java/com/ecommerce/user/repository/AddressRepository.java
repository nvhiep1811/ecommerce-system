package com.ecommerce.user.repository;

import com.ecommerce.user.domain.AddressEntity;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AddressRepository extends JpaRepository<AddressEntity, Long> {

    List<AddressEntity> findAllByUserIdOrderByIsDefaultDescCreatedAtDesc(UUID userId);

    Optional<AddressEntity> findByIdAndUserId(Long id, UUID userId);

    boolean existsByUserId(UUID userId);

    @Transactional
    @Modifying
    @Query("update AddressEntity a set a.isDefault = false where a.userId = :userId")
    void clearDefaultByUserId(UUID userId);
}
