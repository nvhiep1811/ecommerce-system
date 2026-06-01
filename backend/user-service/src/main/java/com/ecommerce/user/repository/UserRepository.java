package com.ecommerce.user.repository;

import com.ecommerce.user.domain.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("""
            select distinct u
            from UserEntity u
            join u.roles role
            where role in ('CUSTOMER', 'SELLER')
              and (:role is null or role = :role)
              and (:status is null or u.status = :status)
              and (
                :keyword is null
                or u.email ilike concat('%', :keyword, '%')
                or u.fullName ilike concat('%', :keyword, '%')
                or coalesce(u.phoneNumber, '') ilike concat('%', :keyword, '%')
              )
            order by u.createdAt desc
            """)
    List<UserEntity> findManagedAccounts(
            @Param("role") String role,
            @Param("status") String status,
            @Param("keyword") String keyword
    );
}