import { apiClient } from "./apiClient";
import type { ManagedUser } from "../types/api";

export type UserRoleFilter = "CUSTOMER" | "SELLER" | "";
export type UserStatusFilter = "active" | "inactive" | "blocked" | "";

const buildQuery = (params: Record<string, string>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: ManagedUser[]; expiresAt: number }>();
const inFlight = new Map<string, Promise<ManagedUser[]>>();

const cacheKey = (role: UserRoleFilter, status: UserStatusFilter, keyword: string) =>
  JSON.stringify({ role, status, keyword: keyword.trim().toLowerCase() });

const putCache = (key: string, data: ManagedUser[]) => {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

const getCache = (key: string) => {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

const patchCachedUser = (updated: ManagedUser) => {
  cache.forEach((entry, key) => {
    const filters = JSON.parse(key) as { role: UserRoleFilter; status: UserStatusFilter; keyword: string };
    const nextData = entry.data
      .map((account) => (account.id === updated.id ? updated : account))
      .filter((account) => accountMatchesFilters(account, filters));
    cache.set(key, { ...entry, data: nextData });
  });
};

const accountMatchesFilters = (
  account: ManagedUser,
  filters: { role: UserRoleFilter; status: UserStatusFilter; keyword: string },
) => {
  if (filters.role && account.role.toLowerCase() !== filters.role.toLowerCase()) {
    return false;
  }
  if (filters.status && account.status !== filters.status) {
    return false;
  }
  if (!filters.keyword) {
    return true;
  }
  const haystack = [account.email, account.fullName, account.phoneNumber ?? ""].join(" ").toLowerCase();
  return haystack.includes(filters.keyword);
};

export const userService = {
  getCachedManagedUsers(role: UserRoleFilter = "", status: UserStatusFilter = "", keyword = "") {
    return getCache(cacheKey(role, status, keyword));
  },
  async listManagedUsers(role: UserRoleFilter = "", status: UserStatusFilter = "", keyword = "", force = false) {
    const key = cacheKey(role, status, keyword);
    if (!force) {
      const cached = getCache(key);
      if (cached) {
        return cached;
      }
      const pending = inFlight.get(key);
      if (pending) {
        return pending;
      }
    }

    const request = apiClient
      .get<ManagedUser[]>(`/admin/users${buildQuery({ role, status, q: keyword.trim() })}`)
      .then((data) => {
        putCache(key, data);
        return data;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, request);
    return request;
  },
  async updateStatus(id: string, status: "active" | "blocked" | "inactive") {
    const updated = await apiClient.patch<ManagedUser>(`/admin/users/${id}/status`, { status });
    patchCachedUser(updated);
    return updated;
  },
};
