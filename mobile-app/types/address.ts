export type Address = {
  id: number;
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
};
