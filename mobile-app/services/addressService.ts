import { apiClient } from "@/services/apiClient";
import { Address } from "@/types/address";

const addressCache = new Map<number, Address>();

const mapAddress = (payload: any): Address => ({
  id: payload.id,
  user_id: payload.userId,
  full_name: payload.fullName,
  phone: payload.phone,
  address_line: payload.addressLine,
  ward: payload.ward ?? "",
  district: payload.district ?? "",
  city: payload.city,
  province: payload.province ?? "",
  postal_code: payload.postalCode ?? "",
  country: payload.country ?? "Vietnam",
  is_default: payload.isDefault,
});

const getAddresses = async () => {
  const data = await apiClient.get<any[]>("/users/addresses");
  return data.map(mapAddress);
};

const getAddressById = async (id: number) => {
  if (addressCache.has(id)) {
    return addressCache.get(id);
  }

  const data = await apiClient.get<any>(`/users/addresses/${id}`);
  const mapped = mapAddress(data);
  addressCache.set(id, mapped);
  return mapped;
};

const getAddressesByUser = async (userId: string) => {
  void userId;
  return getAddresses();
};

const getDefaultAddress = async (userId: string) => {
  const addresses = await getAddressesByUser(userId);
  return addresses.find((address) => address.is_default) ?? null;
};

const createAddress = async (addressData: {
  user_id: string;
  full_name: string;
  phone: string;
  address_line: string;
  ward?: string;
  district?: string;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  is_default: boolean;
}) => {
  const data = await apiClient.post<any>("/users/addresses", {
    fullName: addressData.full_name,
    phone: addressData.phone,
    addressLine: addressData.address_line,
    ward: addressData.ward,
    district: addressData.district,
    city: addressData.city,
    province: addressData.province,
    postalCode: addressData.postal_code,
    country: addressData.country,
    isDefault: addressData.is_default,
  });
  const mapped = mapAddress(data);
  addressCache.delete(mapped.id);
  return mapped;
};

const updateAddress = async (
  id: number,
  addressData: Partial<{
    full_name: string;
    phone: string;
    address_line: string;
    ward: string;
    district: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
    is_default: boolean;
  }>,
) => {
  const data = await apiClient.put<any>(`/users/addresses/${id}`, {
    fullName: addressData.full_name,
    phone: addressData.phone,
    addressLine: addressData.address_line,
    ward: addressData.ward,
    district: addressData.district,
    city: addressData.city,
    province: addressData.province,
    postalCode: addressData.postal_code,
    country: addressData.country,
    isDefault: addressData.is_default,
  });
  const mapped = mapAddress(data);
  addressCache.delete(id);
  return mapped;
};

const deleteAddress = async (id: number) => {
  await apiClient.delete<void>(`/users/addresses/${id}`);
  addressCache.delete(id);
  return true;
};

const setDefaultAddress = async (userId: string, addressId: number) => {
  const data = await apiClient.post<any>(
    `/users/addresses/${addressId}/default`,
  );
  addressCache.delete(addressId);
  return mapAddress(data);
};

const addressService = {
  getAddresses,
  getAddressById,
  getAddressesByUser,
  getDefaultAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
export { addressService };
