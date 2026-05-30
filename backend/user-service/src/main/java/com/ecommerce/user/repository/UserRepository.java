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
              and (cast(:role as text) is null or role = :role)
              and (cast(:status as text) is null or lower(u.status) = :status)
              and (
                cast(:keyword as text) is null
                or cast(u.email as text) like concat('%', cast(:keyword as text), '%')
                or lower(u.fullName) like concat('%', cast(:keyword as text), '%')
                or lower(coalesce(u.phoneNumber, '')) like concat('%', cast(:keyword as text), '%')
              )
            order by u.createdAt desc
            """)
    List<UserEntity> findManagedAccounts(
            @Param("role") String role,
            @Param("status") String status,
            @Param("keyword") String keyword
    );
}