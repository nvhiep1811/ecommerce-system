export type VietnamProvince = {
  code: number;
  name: string;
};

export type VietnamDistrict = {
  code: number;
  name: string;
  province_code: number;
};

export type VietnamWard = {
  code: number;
  name: string;
  district_code: number;
};

const VIETNAM_PROVINCES_API = "https://provinces.open-api.vn/api/p/";
const VIETNAM_DISTRICT_API = "https://provinces.open-api.vn/api/d/";

let cachedProvinces: VietnamProvince[] | null = null;
const cachedDistrictsByProvince = new Map<number, VietnamDistrict[]>();
const cachedWardsByDistrict = new Map<number, VietnamWard[]>();

const normalizeName = (value: string) => value.trim().toLowerCase();

const mapAndSortProvinces = (items: unknown[]): VietnamProvince[] => {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as { code?: unknown; name?: unknown };
      const code = Number(record.code);
      const name = typeof record.name === "string" ? record.name.trim() : "";

      if (!Number.isFinite(code) || !name) {
        return null;
      }

      return { code, name };
    })
    .filter((province): province is VietnamProvince => Boolean(province))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
};

const fetchProvinces = async (): Promise<VietnamProvince[]> => {
  const response = await fetch(VIETNAM_PROVINCES_API);
  if (!response.ok) {
    throw new Error("Failed to fetch Vietnam provinces");
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Invalid provinces payload");
  }

  return mapAndSortProvinces(payload);
};

const mapDistricts = (
  provinceCode: number,
  items: unknown[],
): VietnamDistrict[] => {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as { code?: unknown; name?: unknown };
      const code = Number(record.code);
      const name = typeof record.name === "string" ? record.name.trim() : "";

      if (!Number.isFinite(code) || !name) {
        return null;
      }

      return { code, name, province_code: provinceCode };
    })
    .filter((district): district is VietnamDistrict => Boolean(district))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
};

const mapWards = (districtCode: number, items: unknown[]): VietnamWard[] => {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as { code?: unknown; name?: unknown };
      const code = Number(record.code);
      const name = typeof record.name === "string" ? record.name.trim() : "";

      if (!Number.isFinite(code) || !name) {
        return null;
      }

      return { code, name, district_code: districtCode };
    })
    .filter((ward): ward is VietnamWard => Boolean(ward))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
};

const fetchDistrictsByProvince = async (
  provinceCode: number,
): Promise<VietnamDistrict[]> => {
  const response = await fetch(
    `${VIETNAM_PROVINCES_API}${provinceCode}?depth=2`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch districts");
  }

  const payload = (await response.json()) as {
    districts?: unknown;
  };

  if (!Array.isArray(payload?.districts)) {
    throw new Error("Invalid districts payload");
  }

  return mapDistricts(provinceCode, payload.districts);
};

const fetchWardsByDistrict = async (
  districtCode: number,
): Promise<VietnamWard[]> => {
  const response = await fetch(
    `${VIETNAM_DISTRICT_API}${districtCode}?depth=2`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch wards");
  }

  const payload = (await response.json()) as {
    wards?: unknown;
  };

  if (!Array.isArray(payload?.wards)) {
    throw new Error("Invalid wards payload");
  }

  return mapWards(districtCode, payload.wards);
};

export const vietnamAddressService = {
  async getProvinces(): Promise<VietnamProvince[]> {
    if (cachedProvinces) {
      return cachedProvinces;
    }

    const provinces = await fetchProvinces();
    cachedProvinces = provinces;
    return provinces;
  },

  async getDistrictsByProvince(
    provinceCode: number,
  ): Promise<VietnamDistrict[]> {
    if (cachedDistrictsByProvince.has(provinceCode)) {
      return cachedDistrictsByProvince.get(provinceCode) || [];
    }

    const districts = await fetchDistrictsByProvince(provinceCode);
    cachedDistrictsByProvince.set(provinceCode, districts);
    return districts;
  },

  async getWardsByDistrict(districtCode: number): Promise<VietnamWard[]> {
    if (cachedWardsByDistrict.has(districtCode)) {
      return cachedWardsByDistrict.get(districtCode) || [];
    }

    const wards = await fetchWardsByDistrict(districtCode);
    cachedWardsByDistrict.set(districtCode, wards);
    return wards;
  },

  findProvinceByName(
    provinces: VietnamProvince[],
    provinceName: string,
  ): VietnamProvince | null {
    if (!provinceName.trim()) {
      return null;
    }

    const target = normalizeName(provinceName);
    return (
      provinces.find((province) => normalizeName(province.name) === target) ||
      null
    );
  },

  findDistrictFromText(
    districts: VietnamDistrict[],
    cityText: string,
  ): VietnamDistrict | null {
    const normalizedCity = normalizeName(cityText);
    if (!normalizedCity) {
      return null;
    }

    const exact = districts.find(
      (district) => normalizeName(district.name) === normalizedCity,
    );
    if (exact) {
      return exact;
    }

    return (
      districts.find((district) =>
        normalizedCity.includes(normalizeName(district.name)),
      ) || null
    );
  },

  findWardFromText(wards: VietnamWard[], cityText: string): VietnamWard | null {
    const normalizedCity = normalizeName(cityText);
    if (!normalizedCity) {
      return null;
    }

    return (
      wards.find((ward) => normalizedCity.includes(normalizeName(ward.name))) ||
      null
    );
  },
};
