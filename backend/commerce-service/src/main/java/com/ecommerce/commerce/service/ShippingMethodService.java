package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.ShippingMethodEntity;
import com.ecommerce.commerce.dto.ShippingMethodRequest;
import com.ecommerce.commerce.dto.ShippingMethodResponse;
import com.ecommerce.commerce.dto.ShippingMethodsResponse;
import com.ecommerce.commerce.repository.ShippingMethodRepository;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public ShippingMethodResponse createShippingMethod(ShippingMethodRequest request) {
        ShippingMethodEntity entity = new ShippingMethodEntity();

        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setEstimatedMinDays(request.estimatedMinDays());
        entity.setEstimatedMaxDays(request.estimatedMaxDays());
        entity.setFee(request.fee());
        entity.setActive(true); // Mặc định là active khi tạo mới

        return toResponse(shippingMethodRepository.save(entity));
    }

    @Transactional
    public ShippingMethodResponse updateShippingMethod(Long id, ShippingMethodRequest request) {
        ShippingMethodEntity entity = shippingMethodRepository.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Shipping method not found"));

        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setEstimatedMinDays(request.estimatedMinDays());
        entity.setEstimatedMaxDays(request.estimatedMaxDays());
        entity.setFee(request.fee());

        return toResponse(shippingMethodRepository.save(entity));
    }

    @Transactional
    public void deleteShippingMethod(Long id) {
        if (!shippingMethodRepository.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "Shipping method not found");
        }
        shippingMethodRepository.deleteById(id);
    }
}