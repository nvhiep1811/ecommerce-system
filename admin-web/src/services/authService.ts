import { apiClient, tokenStore } from "./apiClient";
import type { AdminUser, AuthResponse } from "../types/api";

export const authService = {
  async login(email: string, password: string) {
    const response = await apiClient.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    tokenStore.set(response.accessToken);
    return response.user;
  },
  async me() {
    return apiClient.get<AdminUser>("/users/me");
  },
  async logout() {
    try {
      await apiClient.post<void>("/auth/logout");
    } finally {
      tokenStore.clear();
    }
  },
  getToken() {
    return tokenStore.get();
  },
  clearToken() {
    tokenStore.clear();
  },
};
