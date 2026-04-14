package com.ecommerce.shared.domain;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@MappedSuperclass
public abstract class VersionedAuditableEntity extends AuditableEntity {

    @Version
    @Column(name = "version", nullable = false)
    private Long version;
}
