import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const STORAGE_BUCKET =
  process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET || "product-images";

type UploadAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

const getSupabase = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
};

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inferExtension = (asset: UploadAsset) => {
  const fileName = asset.fileName || asset.uri.split("/").pop() || "image.jpg";
  const match = fileName.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : "jpg";
};

export const uploadProductImage = async (asset: UploadAsset) => {
  console.log("🚀 START UPLOAD");

  const supabase = getSupabase();

  const extension = inferExtension(asset);
  const originalName = asset.fileName || `product-image.${extension}`;
  const baseName = originalName.replace(/\.[a-zA-Z0-9]+$/, "");
  const safeName = sanitizeFileName(baseName) || "product-image";

  const filePath = `products/${Date.now()}-${safeName}.${extension}`;

  // ⚠️ Quan trọng: fetch → blob (Expo compatible)
  const response = await fetch(asset.uri);
  const blob = await response.blob();

  console.log("📦 Uploading:", filePath);

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, blob, {
      contentType: asset.mimeType || `image/${extension}`,
      upsert: true,
    });

  if (error) {
    console.log("UPLOAD ERROR:", error);
    throw new Error(error.message);
  }

  console.log("Upload success:", data);

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  console.log("Public URL:", publicUrl);

  return publicUrl;
};