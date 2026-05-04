package com.ecommerce.user.service;

import com.ecommerce.shared.web.BusinessException;
import com.ecommerce.user.config.AuthOtpProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

@Service
public class OtpService {

    private static final String PURPOSE_REGISTER = "register";
    private static final String PURPOSE_PASSWORD_RESET = "password-reset";

    private final StringRedisTemplate redisTemplate;
    private final AuthOtpProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public OtpService(StringRedisTemplate redisTemplate, AuthOtpProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    public IssuedOtp issueRegistrationOtp(String email) {
        return issueOtp(PURPOSE_REGISTER, email);
    }

    public IssuedOtp issuePasswordResetOtp(String email) {
        return issueOtp(PURPOSE_PASSWORD_RESET, email);
    }

    public void verifyRegistrationOtp(String email, String otp) {
        verifyOtp(PURPOSE_REGISTER, email, otp, true);
    }

    public String verifyPasswordResetOtp(String email, String otp) {
        verifyOtp(PURPOSE_PASSWORD_RESET, email, otp, true);
        String normalizedEmail = normalizeEmail(email);
        String resetToken = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
                resetTokenKey(normalizedEmail),
                hash(resetToken),
                Duration.ofMinutes(properties.getResetTokenTtlMinutes())
        );
        return resetToken;
    }

    public void consumePasswordResetToken(String email, String resetToken) {
        String normalizedEmail = normalizeEmail(email);
        String key = resetTokenKey(normalizedEmail);
        String storedHash = redisTemplate.opsForValue().get(key);
        if (storedHash == null || !storedHash.equals(hash(resetToken))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Invalid or expired reset token");
        }
        redisTemplate.delete(key);
    }

    public long otpExpiresInSeconds() {
        return Duration.ofMinutes(properties.getTtlMinutes()).toSeconds();
    }

    public long resetTokenExpiresInSeconds() {
        return Duration.ofMinutes(properties.getResetTokenTtlMinutes()).toSeconds();
    }

    private IssuedOtp issueOtp(String purpose, String email) {
        if (!properties.isEnabled()) {
            return new IssuedOtp("", false);
        }
        String normalizedEmail = normalizeEmail(email);
        String cooldownKey = cooldownKey(purpose, normalizedEmail);
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            return new IssuedOtp("", false);
        }

        String otp = generateOtp();
        redisTemplate.opsForValue().set(
                otpKey(purpose, normalizedEmail),
                hash(otp),
                Duration.ofMinutes(properties.getTtlMinutes())
        );
        redisTemplate.delete(attemptKey(purpose, normalizedEmail));
        redisTemplate.opsForValue().set(
                cooldownKey,
                "1",
                Duration.ofSeconds(properties.getResendCooldownSeconds())
        );
        return new IssuedOtp(otp, true);
    }

    private void verifyOtp(String purpose, String email, String otp, boolean consume) {
        if (!properties.isEnabled()) {
            return;
        }
        String normalizedEmail = normalizeEmail(email);
        String attemptsKey = attemptKey(purpose, normalizedEmail);
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        if (attempts != null && attempts == 1L) {
            redisTemplate.expire(attemptsKey, Duration.ofMinutes(properties.getTtlMinutes()));
        }
        if (attempts != null && attempts > properties.getMaxAttempts()) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "Too many invalid OTP attempts");
        }

        String key = otpKey(purpose, normalizedEmail);
        String storedHash = redisTemplate.opsForValue().get(key);
        if (storedHash == null || otp == null || !storedHash.equals(hash(otp.trim()))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Invalid or expired OTP");
        }
        if (consume) {
            redisTemplate.delete(key);
            redisTemplate.delete(attemptsKey);
            redisTemplate.delete(cooldownKey(purpose, normalizedEmail));
        }
    }

    private String generateOtp() {
        int length = Math.max(4, Math.min(8, properties.getLength()));
        int bound = (int) Math.pow(10, length);
        int floor = bound / 10;
        return String.valueOf(floor + secureRandom.nextInt(bound - floor));
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String otpKey(String purpose, String email) {
        return "auth:otp:" + purpose + ":" + email;
    }

    private String attemptKey(String purpose, String email) {
        return "auth:otp:attempts:" + purpose + ":" + email;
    }

    private String cooldownKey(String purpose, String email) {
        return "auth:otp:cooldown:" + purpose + ":" + email;
    }

    private String resetTokenKey(String email) {
        return "auth:reset-token:" + email;
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest((value + ":" + properties.getSecret()).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    public record IssuedOtp(String otp, boolean shouldSendEmail) {
    }
}
