export type User = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  gender?: string | null;
  birth_date?: string | null;
  created_at: string;
  updated_at: string;
  role: string | null;
};
