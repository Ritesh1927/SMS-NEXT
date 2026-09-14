import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

const IMAGE_ALLOWED = [".jpg", ".jpeg", ".png", ".webp"];
const DOCUMENT_ALLOWED = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt"];

export interface UploadResult {
  url: string;
  publicId: string;
}

// Next.js route handlers read multipart bodies natively via
// request.formData() (the Web-standard API), so there's no need for
// multer/multer-storage-cloudinary the way the Express backend used them —
// this just streams the already-parsed File's bytes straight to Cloudinary.
function uploadBuffer(
  buffer: Buffer,
  options: { folder: string; resourceType: "image" | "raw"; publicId: string; transformation?: object[] },
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType,
        public_id: options.publicId,
        transformation: options.transformation,
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Cloudinary upload failed with no result."));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function newPublicId(ext = ""): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
}

// Profile photos: square-cropped, face-aware, capped at 5 MB.
export async function uploadProfilePhoto(file: File): Promise<UploadResult> {
  const ext = extOf(file.name);
  if (!IMAGE_ALLOWED.includes(ext)) {
    throw new Error(`File type not allowed. Allowed: ${IMAGE_ALLOWED.join(", ")}`);
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadBuffer(buffer, {
    folder: "profile-photos",
    resourceType: "image",
    publicId: newPublicId(),
    transformation: [{ width: 500, height: 500, crop: "fill", gravity: "face" }],
  });
}

// Documents (homework attachments, study materials, etc.) — stored as
// resource_type "raw"; the extension has to be baked into the public_id
// since raw resources don't infer one the way image/video do.
export async function uploadDocument(file: File, folder: string, maxSizeMB = 20): Promise<UploadResult> {
  const ext = extOf(file.name);
  if (!DOCUMENT_ALLOWED.includes(ext)) {
    throw new Error(`File type not allowed. Allowed: ${DOCUMENT_ALLOWED.join(", ")}`);
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`File must be under ${maxSizeMB} MB.`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadBuffer(buffer, {
    folder,
    resourceType: "raw",
    publicId: newPublicId(ext),
  });
}

export async function deleteAsset(publicId: string, resourceType: "image" | "raw"): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.log("Cloudinary delete failed:", err instanceof Error ? err.message : err);
  }
}
