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
                or cast(u.email as string) ilike concat('%', cast(:keyword as string), '%')
                or cast(u.fullName as string) ilike concat('%', cast(:keyword as string), '%')
                or cast(coalesce(u.phoneNumber, '') as string) ilike concat('%', cast(:keyword as string), '%')
              )
            order by u.createdAt desc
            """)
    List<UserEntity> findManagedAccounts(
            @Param("role") String role,
            @Param("status") String status,
            @Param("keyword") String keyword
    );
}
