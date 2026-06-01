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
              and (cast(:role as text) is null or role = cast(:role as text))
              and (cast(:status as text) is null or lower(cast(u.status as text)) = lower(cast(:status as text)))
              and (
                cast(:keyword as text) is null
                or lower(cast(u.email as text)) like lower(concat('%', cast(:keyword as text), '%'))
                or lower(cast(u.fullName as text)) like lower(concat('%', cast(:keyword as text), '%'))
                or lower(cast(coalesce(u.phoneNumber, '') as text)) like lower(concat('%', cast(:keyword as text), '%'))
              )
            order by u.createdAt desc
            """)
    List<UserEntity> findManagedAccounts(
            @Param("role") String role,
            @Param("status") String status,
            @Param("keyword") String keyword
    );
}