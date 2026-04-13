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

        AddressEntity address = new AddressEntity();
        address.setUserId(userId);
        address.setReceiverName(request.fullName().trim());
        address.setReceiverPhone(request.phone().trim());
        address.setAddressLine(request.addressLine().trim());
        address.setCity(request.city().trim());
        address.setProvince(request.province());
        address.setPostalCode(request.postalCode());
        address.setWard(null);
        address.setDistrict(null);
        address.setCountry("Vietnam");
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

        address.setReceiverName(request.fullName().trim());
        address.setReceiverPhone(request.phone().trim());
        address.setAddressLine(request.addressLine().trim());
        address.setCity(request.city().trim());
        address.setProvince(request.province());
        address.setPostalCode(request.postalCode());
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
}
