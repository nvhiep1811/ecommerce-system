package com.ecommerce.user.service;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.user.domain.AddressEntity;
import com.ecommerce.user.dto.AddressRequest;
import com.ecommerce.user.dto.AddressResponse;
import com.ecommerce.user.repository.AddressRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class AddressService {

    private final AddressRepository addressRepository;

    public AddressService(AddressRepository addressRepository) {
        this.addressRepository = addressRepository;
    }

    public List<AddressResponse> list(AuthenticatedUser principal) {
        UUID userId = UUID.fromString(principal.userId());
        return addressRepository.findAllByUserIdOrderByIsDefaultDescCreatedAtDesc(userId)
                .stream()
                .map(UserMapper::toAddress)
                .toList();
    }

    public AddressResponse get(AuthenticatedUser principal, Long addressId) {
        UUID userId = UUID.fromString(principal.userId());
        AddressEntity address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Address not found"));
        return UserMapper.toAddress(address);
    }

    public AddressResponse create(AuthenticatedUser principal, AddressRequest request) {
        UUID userId = UUID.fromString(principal.userId());
        boolean shouldBeDefault = request.isDefault() || !addressRepository.existsByUserId(userId);
        if (shouldBeDefault) {
            addressRepository.clearDefaultByUserId(userId);
        }

        AreaParts areaParts = deriveAreaParts(request.ward(), request.district(), request.city());
        String provincia = normalizeNullable(request.province());

        AddressEntity address = new AddressEntity();
        address.setUserId(userId);
        address.setReceiverName(request.fullName().trim());
        address.setReceiverPhone(request.phone().trim());
        address.setAddressLine(request.addressLine().trim());
        address.setCity(provincia);  // city = province (not composite "District, Ward")
        address.setProvince(provincia);
        address.setPostalCode(normalizeNullable(request.postalCode()));
        address.setWard(areaParts.ward());
        address.setDistrict(areaParts.district());
        address.setCountry(defaultCountry(request.country()));
        address.setDefault(shouldBeDefault);

        return UserMapper.toAddress(addressRepository.save(address));
    }

    public AddressResponse update(AuthenticatedUser principal, Long addressId, AddressRequest request) {
        UUID userId = UUID.fromString(principal.userId());
        AddressEntity address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Address not found"));

        if (request.isDefault()) {
            addressRepository.clearDefaultByUserId(userId);
        }

        AreaParts areaParts = deriveAreaParts(request.ward(), request.district(), request.city());
        String provincia = normalizeNullable(request.province());

        address.setReceiverName(request.fullName().trim());
        address.setReceiverPhone(request.phone().trim());
        address.setAddressLine(request.addressLine().trim());
        address.setCity(provincia);  // city = province (not composite "District, Ward")
        address.setProvince(provincia);
        address.setPostalCode(normalizeNullable(request.postalCode()));
        address.setWard(areaParts.ward());
        address.setDistrict(areaParts.district());
        address.setCountry(defaultCountry(request.country()));
        address.setDefault(request.isDefault());

        return UserMapper.toAddress(addressRepository.save(address));
    }

    public void delete(AuthenticatedUser principal, Long addressId) {
        UUID userId = UUID.fromString(principal.userId());
        AddressEntity address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Address not found"));
        addressRepository.delete(address);
    }

    public AddressResponse setDefault(AuthenticatedUser principal, Long addressId) {
        UUID userId = UUID.fromString(principal.userId());
        AddressEntity address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Address not found"));
        addressRepository.clearDefaultByUserId(userId);
        address.setDefault(true);
        return UserMapper.toAddress(addressRepository.save(address));
    }

    public AddressResponse getInternal(Long addressId) {
        AddressEntity address = addressRepository.findById(addressId)
                .orElseThrow(() -> new EntityNotFoundException("Address not found"));
        return UserMapper.toAddress(address);
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String defaultCountry(String country) {
        String normalized = normalizeNullable(country);
        return normalized == null ? "Vietnam" : normalized;
    }

    private AreaParts deriveAreaParts(String ward, String district, String city) {
        String normalizedWard = normalizeNullable(ward);
        String normalizedDistrict = normalizeNullable(district);

        if (normalizedWard != null && normalizedDistrict != null) {
            return new AreaParts(normalizedWard, normalizedDistrict);
        }

        String normalizedCity = normalizeNullable(city);
        if (normalizedCity == null || !normalizedCity.contains(",")) {
            return new AreaParts(normalizedWard, normalizedDistrict);
        }

        String[] parts = normalizedCity.split(",", 2);
        String districtFromCity = normalizeNullable(parts[0]);
        String wardFromCity = parts.length > 1 ? normalizeNullable(parts[1]) : null;

        return new AreaParts(
                normalizedWard != null ? normalizedWard : wardFromCity,
                normalizedDistrict != null ? normalizedDistrict : districtFromCity
        );
    }

    private record AreaParts(String ward, String district) {
    }
}
