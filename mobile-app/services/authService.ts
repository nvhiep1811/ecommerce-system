import { apiClient, ApiError } from "@/services/apiClient";
import { User } from "@/types/user";

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role?: "customer" | "seller";
}

export type UserProfile = User;

interface AuthApiResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    phoneNumber: string | null;
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

  async resetPassword(email: string) {
    return {
      error: "Chức năng đặt lại mật khẩu chưa được triển khai",
      message: null,
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
