package com.ecommerce.user.service;

import com.ecommerce.user.domain.AddressEntity;
import com.ecommerce.user.domain.UserEntity;
import com.ecommerce.user.dto.AddressResponse;
import com.ecommerce.user.dto.UserProfileResponse;

import java.util.Set;

public final class UserMapper {

    private UserMapper() {
    }

    public static UserProfileResponse toProfile(UserEntity entity) {
        return new UserProfileResponse(
                entity.getId(),
                entity.getEmail(),
                entity.getFullName(),
                entity.getAvatarUrl(),
                entity.getPhoneNumber(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                toMobileRole(entity.getRoles())
        );
    }

    public static AddressResponse toAddress(AddressEntity entity) {
        return new AddressResponse(
                entity.getId(),
                entity.getUserId(),
                entity.getReceiverName(),
                entity.getReceiverPhone(),
                entity.getAddressLine(),
                entity.getWard(),
                entity.getDistrict(),
                entity.getCity(),
                entity.getProvince(),
                entity.getPostalCode(),
                entity.getCountry(),
                entity.isDefault()
        );
    }

    public static String toMobileRole(Set<String> roles) {
        if (roles.contains("ADMIN")) {
            return "admin";
        }
        if (roles.contains("SELLER")) {
            return "seller";
        }
        return "customer";
    }
}
