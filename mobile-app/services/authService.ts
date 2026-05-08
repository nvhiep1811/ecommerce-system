import { apiClient, ApiError } from "@/services/apiClient";
import { User } from "@/types/user";
import { Platform } from "react-native";

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role?: "customer" | "seller";
  otp?: string;
}

export type UserProfile = User;

export interface AvatarUploadAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

interface OtpApiResponse {
  message: string;
  expiresInSeconds: number;
}

interface PasswordResetTokenApiResponse {
  resetToken: string;
  expiresInSeconds: number;
}

interface AuthApiResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    phoneNumber: string | null;
    gender?: string | null;
    birthDate?: string | null;
    dateOfBirth?: string | null;
    createdAt: string;
    updatedAt: string;
    role: string | null;
  };
}

const mapUser = (payload: AuthApiResponse["user"]): User => ({
  id: payload.id,
  email: payload.email,
  full_name: payload.fullName,
  avatar_url: payload.avatarUrl,
  phone_number: payload.phoneNumber,
  gender: payload.gender ?? null,
  birth_date: payload.birthDate ?? payload.dateOfBirth ?? null,
  created_at: payload.createdAt,
  updated_at: payload.updatedAt,
  role: payload.role,
});

class AuthService {
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Yêu cầu quá thời gian chờ")), ms),
      ),
    ]);
  }

  async signUp(data: SignUpData) {
    try {
      const response = await apiClient.post<AuthApiResponse>("/auth/register", {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        role: data.role || "customer",
        otp: data.otp,
      });
      await apiClient.setToken(response.accessToken);
      return { data: { user: mapUser(response.user) }, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Đăng ký thất bại",
      };
    }
  }

  async requestRegistrationOtp(email: string) {
    try {
      const response = await apiClient.post<OtpApiResponse>(
        "/auth/register/request-otp",
        { email },
      );
      return { data: response, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Không thể gửi mã OTP",
      };
    }
  }

  async signIn(email: string, password: string) {
    try {
      const response = await apiClient.post<AuthApiResponse>("/auth/login", {
        email,
        password,
      });
      await apiClient.setToken(response.accessToken);
      return { data: { user: mapUser(response.user) }, error: null };
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Đăng nhập thất bại";
      return { data: null, error: message };
    }
  }

  async signOut() {
    try {
      await this.withTimeout(apiClient.post<void>("/auth/logout"), 3000);
    } catch {
    } finally {
      await apiClient.clearToken();
    }
    return { error: null };
  }

  async getCurrentUser() {
    try {
      const profile = await apiClient.get<AuthApiResponse["user"]>("/users/me");
      return { user: mapUser(profile), error: null };
    } catch (error) {
      return {
        user: null,
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải người dùng hiện tại",
      };
    }
  }

  async getUserProfile(
    userId?: string,
  ): Promise<{ profile: UserProfile | null; error: string | null }> {
    try {
      const profile = await apiClient.get<AuthApiResponse["user"]>("/users/me");
      const mapped = mapUser(profile);
      if (userId && mapped.id !== userId) {
        return { profile: null, error: "Không hỗ trợ tra cứu hồ sơ này" };
      }
      return { profile: mapped, error: null };
    } catch (error) {
      return {
        profile: null,
        error: error instanceof Error ? error.message : "Không thể tải hồ sơ",
      };
    }
  }

  async updateProfile(updates: Partial<UserProfile>) {
    try {
      const payload = await apiClient.put<AuthApiResponse["user"]>(
        "/users/me",
        {
          fullName: updates.full_name ?? null,
          phoneNumber: updates.phone_number ?? null,
          email: updates.email ?? null,
          gender: updates.gender ?? null,
          birthDate: updates.birth_date ?? null,
          avatarUrl: updates.avatar_url ?? null,
        },
      );
      return { data: mapUser(payload), error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error ? error.message : "Không thể cập nhật hồ sơ",
      };
    }
  }

  async uploadAvatar(asset: AvatarUploadAsset) {
    try {
      const fileName = asset.fileName || `avatar-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";
      const formData = new FormData();

      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        (formData as any).append("file", blob, fileName);
      } else {
        (formData as any).append("file", {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        });
      }

      const payload = await apiClient.uploadMultipart<AuthApiResponse["user"]>(
        "/users/me/avatar",
        formData,
      );
      return { data: mapUser(payload), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Không thể cập nhật ảnh đại diện",
      };
    }
  }

  async requestPasswordResetOtp(email: string) {
    try {
      const response = await apiClient.post<OtpApiResponse>(
        "/auth/password/forgot",
        { email },
      );
      return { data: response, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Không thể gửi mã OTP",
      };
    }
  }

  async verifyPasswordResetOtp(email: string, otp: string) {
    try {
      const response = await apiClient.post<PasswordResetTokenApiResponse>(
        "/auth/password/verify-otp",
        { email, otp },
      );
      return { data: response, error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error ? error.message : "Mã OTP không hợp lệ hoặc đã hết hạn",
      };
    }
  }

  async confirmPasswordReset(
    email: string,
    resetToken: string,
    newPassword: string,
  ) {
    try {
      await apiClient.post<void>("/auth/password/reset", {
        email,
        resetToken,
        newPassword,
      });
      return { error: null };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Không thể đặt lại mật khẩu",
      };
    }
  }

  async resetPassword(email: string) {
    const { data, error } = await this.requestPasswordResetOtp(email);
    return {
      error,
      message: data?.message ?? null,
    };
  }

  async signInWithGoogle() {
    return {
      data: null,
      error: "Đăng nhập OAuth chưa được hỗ trợ ở backend mới",
    };
  }

  async signInWithApple() {
    return {
      data: null,
      error: "Đăng nhập OAuth chưa được hỗ trợ ở backend mới",
    };
  }
}

export default new AuthService();
