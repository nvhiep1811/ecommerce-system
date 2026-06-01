package com.ecommerce.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class AuthMailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public AuthMailService(JavaMailSender mailSender, @Value("${spring.mail.username:}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    @Async
    public void sendRegistrationOtp(String email, String otp, int ttlMinutes) {
        send(
                email,
                "Mã xác thực đăng ký tài khoản Mega Mall",
                "Chào bạn,\n\n"
                        + "Bạn đang thực hiện đăng ký tài khoản Mega Mall. Vui lòng sử dụng mã OTP bên dưới để xác thực email:\n\n"
                        + "Mã OTP: " + otp + "\n"
                        + "Hiệu lực: " + ttlMinutes + " phút\n\n"
                        + "Vì lý do bảo mật, không chia sẻ mã này với bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.\n\n"
                        + "Trân trọng,\n"
                        + "Mega Mall"
        );
    }

    @Async
    public void sendPasswordResetOtp(String email, String otp, int ttlMinutes) {
        send(
                email,
                "Mã xác thực đặt lại mật khẩu Mega Mall",
                "Chào bạn,\n\n"
                        + "Mega Mall đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP bên dưới để tiếp tục:\n\n"
                        + "Mã OTP: " + otp + "\n"
                        + "Hiệu lực: " + ttlMinutes + " phút\n\n"
                        + "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này và cân nhắc đổi mật khẩu nếu nghi ngờ tài khoản có rủi ro.\n\n"
                        + "Trân trọng,\n"
                        + "Mega Mall"
        );
    }

    private void send(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            if (fromAddress != null && !fromAddress.isBlank()) {
                message.setFrom(fromAddress);
            }
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Sent auth email '{}' to {}", subject, to);
        } catch (Exception exception) {
            log.error("Failed to send auth email '{}' to {}", subject, to, exception);
        }
    }
}
