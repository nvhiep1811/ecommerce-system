package com.ecommerce.commerce.config;

import com.ecommerce.shared.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtAuthenticationFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET,
                                "/commerce/flash-sales/active",
                                "/flash-sales/active",
                                "/commerce/flash-sales/products/*/active",
                                "/flash-sales/products/*/active"
                        ).permitAll()
                        .requestMatchers(
                                "/actuator/health",
                                "/internal/**",
                                "/payment-methods",
                                "/commerce/payment-methods",
                                "/shipping-methods",
                                "/commerce/shipping-methods",
                                "/payments/sepay/ipn",
                                "/commerce/payments/sepay/ipn",
                                "/webhooks/sepay",
                                "/commerce/webhooks/sepay",
                                "/payments/*/sepay-checkout",
                                "/commerce/payments/*/sepay-checkout"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
