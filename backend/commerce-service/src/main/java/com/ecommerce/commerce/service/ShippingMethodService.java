package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.ShippingMethodEntity;
import com.ecommerce.commerce.dto.ShippingMethodResponse;
import com.ecommerce.commerce.dto.ShippingMethodsResponse;
import com.ecommerce.commerce.repository.ShippingMethodRepository;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ShippingMethodService {

    private final ShippingMethodRepository shippingMethodRepository;

    public ShippingMethodService(ShippingMethodRepository shippingMethodRepository) {
        this.shippingMethodRepository = shippingMethodRepository;
    }

    public ShippingMethodsResponse listMethods() {
        return new ShippingMethodsResponse(
                shippingMethodRepository.findByActiveTrueOrderByIdAsc()
                        .stream()
                        .map(this::toResponse)
                        .toList()
        );
    }

    public ShippingMethodEntity resolveActive(Long shippingMethodId) {
        if (shippingMethodId != null) {
            return shippingMethodRepository.findByIdAndActiveTrue(shippingMethodId)
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Shipping method is not available"));
        }

        return shippingMethodRepository.findFirstByActiveTrueOrderByIdAsc()
                .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "No shipping method is available"));
    }

    private ShippingMethodResponse toResponse(ShippingMethodEntity method) {
        return new ShippingMethodResponse(
                method.getId(),
                method.getName(),
                method.getDescription(),
                method.getEstimatedMinDays(),
                method.getEstimatedMaxDays(),
                method.getFee(),
                method.isActive()
        );
    }
}
