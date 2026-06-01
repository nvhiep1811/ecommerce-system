package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.PaymentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<PaymentEntity, Long> {

    Optional<PaymentEntity> findTopByOrderIdOrderByAttemptNoDesc(Long orderId);

    Optional<PaymentEntity> findByInvoiceNumber(String invoiceNumber);

    @Query(value = """
            select p.*
            from payments p
            left join orders o on o.id = p.order_id
            where p.invoice_number = :reference
               or p.transfer_content = :reference
               or o.order_no = :reference
               or upper(regexp_replace(coalesce(p.invoice_number, ''), '[^A-Za-z0-9]', '', 'g')) = :normalizedReference
               or upper(regexp_replace(coalesce(p.transfer_content, ''), '[^A-Za-z0-9]', '', 'g')) = :normalizedReference
               or upper(regexp_replace(coalesce(o.order_no, ''), '[^A-Za-z0-9]', '', 'g')) = :normalizedReference
               or (
                    length(upper(regexp_replace(coalesce(p.invoice_number, ''), '[^A-Za-z0-9]', '', 'g'))) >= 8
                    and :normalizedReference like '%' || upper(regexp_replace(coalesce(p.invoice_number, ''), '[^A-Za-z0-9]', '', 'g')) || '%'
                  )
               or (
                    length(upper(regexp_replace(coalesce(p.transfer_content, ''), '[^A-Za-z0-9]', '', 'g'))) >= 8
                    and :normalizedReference like '%' || upper(regexp_replace(coalesce(p.transfer_content, ''), '[^A-Za-z0-9]', '', 'g')) || '%'
                  )
               or (
                    length(upper(regexp_replace(coalesce(o.order_no, ''), '[^A-Za-z0-9]', '', 'g'))) >= 8
                    and :normalizedReference like '%' || upper(regexp_replace(coalesce(o.order_no, ''), '[^A-Za-z0-9]', '', 'g')) || '%'
                  )
               or (
                    length(:normalizedReference) >= 8
                    and upper(regexp_replace(coalesce(p.invoice_number, ''), '[^A-Za-z0-9]', '', 'g')) like :normalizedReference || '%'
                  )
               or (
                    length(:normalizedReference) >= 8
                    and upper(regexp_replace(coalesce(p.transfer_content, ''), '[^A-Za-z0-9]', '', 'g')) like :normalizedReference || '%'
                  )
            order by p.id desc
            limit 1
            """, nativeQuery = true)
    Optional<PaymentEntity> findTopByPaymentReference(
            @Param("reference") String reference,
            @Param("normalizedReference") String normalizedReference
    );

    Optional<PaymentEntity> findByProviderAndProviderTransactionId(String provider, String providerTransactionId);

}
