// services/chatUploadService.ts
// Upload ảnh, PDF, video lên Supabase Storage
// Hoạt động trên cả Web và Native (iOS/Android) — không dùng expo-file-system

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "product-images";
const FOLDER = "chat-files";

// ─── Giới hạn dung lượng ─────────────────────────────────────────────────────
const SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,  // 10MB
  pdf:   20 * 1024 * 1024,  // 20MB
  video: 100 * 1024 * 1024, // 100MB
};

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
];

export type ChatFileType = "image" | "pdf" | "video";

export interface ChatUploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  fileType: ChatFileType;
}

function getFileType(mimeType: string): ChatFileType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "video";
}

// ─── Upload chính — dùng fetch + blob, chạy được cả web lẫn native ───────────
export async function uploadChatFile(file: {
  uri: string;
  name: string;
  type: string;
}): Promise<ChatUploadResult> {
  const { uri, name, type } = file;

  // 1. Kiểm tra MIME type
  if (!ALLOWED_MIME_TYPES.includes(type)) {
    throw new Error(`Loại file không được hỗ trợ: ${type}`);
  }

  const fileType = getFileType(type);

  // 2. Fetch URI thành blob (hoạt động trên cả web lẫn native với Expo)
  const fetchRes = await fetch(uri);
  const blob = await fetchRes.blob();
  const fileSize = blob.size;

  // 3. Kiểm tra dung lượng
  const sizeLimit = SIZE_LIMITS[fileType];
  if (fileSize > sizeLimit) {
    const limitMB = sizeLimit / 1024 / 1024;
    const label = fileType === "image" ? "ảnh" : fileType === "pdf" ? "PDF" : "video";
    throw new Error(`File quá lớn. Giới hạn ${label}: ${limitMB}MB`);
  }

  // 4. Tạo tên file unique
  const ext = name.split(".").pop() ?? "bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `${FOLDER}/${uniqueName}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;

  // 5. Upload lên Supabase Storage
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": type,
      "x-upsert": "true",
    },
    body: blob,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload thất bại: ${errText}`);
  }

  // 6. Trả về public URL
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  return { fileUrl: publicUrl, fileName: name, fileSize, contentType: type, fileType };
}