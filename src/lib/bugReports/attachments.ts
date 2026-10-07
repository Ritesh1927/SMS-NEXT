import { randomBytes } from "crypto";
import { cloudinary } from "@/lib/cloudinary";
import type { ITicketAttachment } from "@/models/BugTicket";
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, type AttachmentKind, type ReporterRole } from "./constants";
import type { AttachmentRef } from "./validation";
import type { TicketAuth } from "./auth";

// Attachments go straight from the browser to Cloudinary with a SIGNED,
// single-use set of parameters minted here. Why not stream them through an
// API route like profile photos: Vercel caps function request bodies at
// 4.5 MB, far below a screen recording. Security comes from:
//   1. the signature pins folder, public_id, allowed formats (and image
//      compression) -- the browser can't change any of them;
//   2. each user can only upload into bug-reports/<role>/<their id>/;
//   3. on submit, every referenced file is re-read from Cloudinary's Admin
//      API (verifyAttachments) to confirm it exists, lives in the caller's
//      folder, is an allowed format and is within the size limit. The
//      client's own claims about a file are never trusted.

const ROOT_FOLDER = "bug-reports";

const FORMATS: Record<AttachmentKind, readonly string[]> = { image: IMAGE_EXTENSIONS, video: VIDEO_EXTENSIONS };

export function userFolder(auth: Pick<TicketAuth, "role" | "id">): string {
  return `${ROOT_FOLDER}/${auth.role}/${auth.id}`;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export interface UploadSignature {
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
  maxBytes: number;
}

export function createUploadSignature(auth: TicketAuth, kind: AttachmentKind, maxMB: number): UploadSignature {
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    timestamp: String(timestamp),
    folder: userFolder(auth),
    public_id: randomBytes(12).toString("hex"),
    allowed_formats: FORMATS[kind].join(","),
  };
  // Images: compress on ingest (cap the long edge, smart quality). Videos
  // are stored as uploaded -- transcoding synchronously would stall the
  // upload -- and get q_auto applied at delivery time instead.
  if (kind === "image") params.transformation = "c_limit,w_2400,h_2400/q_auto:good";

  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${kind}/upload`,
    fields: { ...params, api_key: process.env.CLOUDINARY_API_KEY!, signature },
    publicId: `${params.folder}/${params.public_id}`,
    maxBytes: maxMB * 1024 * 1024,
  };
}

export class AttachmentError extends Error {}

interface CloudinaryResource {
  secure_url: string;
  public_id: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  created_at: string;
}

/** Re-reads each referenced upload from Cloudinary and returns trusted metadata. */
export async function verifyAttachments(
  auth: TicketAuth,
  refs: AttachmentRef[],
  limits: { maxImageMB: number; maxVideoMB: number },
): Promise<ITicketAttachment[]> {
  const folder = `${userFolder(auth)}/`;
  const unique = [...new Map(refs.map((r) => [r.publicId, r])).values()];

  return Promise.all(
    unique.map(async (ref) => {
      if (!ref.publicId.startsWith(folder)) throw new AttachmentError("One of the attachments isn't yours.");

      let resource: CloudinaryResource;
      try {
        resource = (await cloudinary.api.resource(ref.publicId, { resource_type: ref.kind })) as CloudinaryResource;
      } catch {
        throw new AttachmentError("An attachment couldn't be found. Please upload it again.");
      }

      const format = (resource.format || "").toLowerCase();
      // Cloudinary reports .jpeg uploads as "jpg".
      if (!FORMATS[ref.kind].includes(format) && !(ref.kind === "image" && format === "jpg")) {
        await destroyAttachment(ref.publicId, ref.kind);
        throw new AttachmentError(`Unsupported file type: .${format || "unknown"}.`);
      }
      const maxMB = ref.kind === "image" ? limits.maxImageMB : limits.maxVideoMB;
      if (resource.bytes > maxMB * 1024 * 1024) {
        await destroyAttachment(ref.publicId, ref.kind);
        throw new AttachmentError(`${ref.kind === "image" ? "Images" : "Videos"} must be under ${maxMB} MB.`);
      }

      return {
        url: resource.secure_url,
        publicId: resource.public_id,
        kind: ref.kind,
        format,
        name: ref.name || `${ref.kind}.${format}`,
        bytes: resource.bytes,
        width: resource.width,
        height: resource.height,
        duration: resource.duration,
        uploadedByRole: auth.role as ReporterRole,
        uploadedAt: new Date(),
      };
    }),
  );
}

export async function destroyAttachment(publicId: string, kind: AttachmentKind): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: kind, invalidate: true });
  } catch (err) {
    console.warn("[bug-reports] Cloudinary delete failed:", err instanceof Error ? err.message : err);
  }
}

