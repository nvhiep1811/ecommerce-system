package com.ecommerce.user.service;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.user.domain.AddressEntity;
import com.ecommerce.user.dto.AddressRequest;
import com.ecommerce.user.dto.AddressResponse;
import com.ecommerce.user.repository.AddressRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AddressServiceTest {

    @Mock
    private AddressRepository addressRepository;

    @InjectMocks
    private AddressService addressService;

    @Test
    void createMakesFirstAddressDefaultAndClearsPreviousDefaults() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", java.util.List.of("CUSTOMER"));
        AddressRequest request = new AddressRequest(
                "  Nguyen Van A ",
                " 0900000000 ",
                " 123 Le Loi ",
                "Ben Nghe",
                "District 1",
                "District 1, Ben Nghe",  // city = composite "District, Ward" (from mobile UI)
                "Ho Chi Minh",  // province
                "700000",
                "Vietnam",
                false
        );

        when(addressRepository.existsByUserId(userId)).thenReturn(false);
        when(addressRepository.save(any(AddressEntity.class))).thenAnswer(invocation -> {
            AddressEntity entity = invocation.getArgument(0);
            entity.setId(10L);
            return entity;
        });

        AddressResponse response = addressService.create(principal, request);

        verify(addressRepository).clearDefaultByUserId(userId);

        ArgumentCaptor<AddressEntity> addressCaptor = ArgumentCaptor.forClass(AddressEntity.class);
        verify(addressRepository).save(addressCaptor.capture());
        AddressEntity saved = addressCaptor.getValue();
        assertEquals(userId, saved.getUserId());
        assertEquals("Nguyen Van A", saved.getReceiverName());
        assertEquals("0900000000", saved.getReceiverPhone());
        assertEquals("123 Le Loi", saved.getAddressLine());
        assertEquals("Ho Chi Minh", saved.getCity());  // city = province (backend normalized it)
        assertEquals("District 1", saved.getDistrict());  // parsed from composite
        assertEquals("Ben Nghe", saved.getWard());  // parsed from composite
        assertEquals("Ho Chi Minh", saved.getProvince());
        assertEquals("700000", saved.getPostalCode());
        assertEquals("Vietnam", saved.getCountry());
        assertTrue(saved.isDefault());

        assertEquals(10L, response.id());
        assertTrue(response.isDefault());
    }

    @Test
    void updateOnlyClearsPreviousDefaultWhenIncomingAddressBecomesDefault() {
        UUID userId = UUID.randomUUID();
        AddressEntity existing = new AddressEntity();
        existing.setId(20L);
        existing.setUserId(userId);
        existing.setDefault(false);
        when(addressRepository.findByIdAndUserId(20L, userId)).thenReturn(Optional.of(existing));
        when(addressRepository.save(any(AddressEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AddressResponse response = addressService.update(
                new AuthenticatedUser(userId.toString(), "buyer@example.com", java.util.List.of("CUSTOMER")),
                20L,
                new AddressRequest("Tran Thi B", "0911222333", "45 Nguyen Hue", "Hai Chau 1", "Hai Chau", "Hai Chau, Hai Chau 1", "Da Nang", "550000", "Vietnam", true)
        );

        verify(addressRepository).clearDefaultByUserId(userId);
        verify(addressRepository).save(existing);
        assertTrue(existing.isDefault());
        assertEquals("Tran Thi B", response.fullName());
        assertEquals("Da Nang", response.city());
        assertEquals("Hai Chau", response.district());
        assertEquals("Hai Chau 1", response.ward());
    }

    @Test
    void setDefaultMarksRequestedAddressAndClearsOldDefaults() {
        UUID userId = UUID.randomUUID();
        AddressEntity existing = new AddressEntity();
        existing.setId(30L);
        existing.setUserId(userId);
        existing.setDefault(false);
        when(addressRepository.findByIdAndUserId(30L, userId)).thenReturn(Optional.of(existing));
        when(addressRepository.save(any(AddressEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AddressResponse response = addressService.setDefault(
                new AuthenticatedUser(userId.toString(), "buyer@example.com", java.util.List.of("CUSTOMER")),
                30L
        );

        verify(addressRepository).clearDefaultByUserId(userId);
        verify(addressRepository).save(existing);
        assertTrue(existing.isDefault());
        assertTrue(response.isDefault());
        assertSame(userId, response.userId());
    }

    @Test
    void createHonorsExistingDefaultWhenRequestDoesNotAskForDefault() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", java.util.List.of("CUSTOMER"));
        when(addressRepository.existsByUserId(userId)).thenReturn(true);
        when(addressRepository.save(any(AddressEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AddressResponse response = addressService.create(
                principal,
                new AddressRequest("Le Van C", "0988777666", "99 Tran Hung Dao", null, null, "Ba Dinh, Ba Dinh", "Ha Noi", "100000", null, false)
        );

        verify(addressRepository, never()).clearDefaultByUserId(userId);
        assertFalse(response.isDefault());
    }
}
