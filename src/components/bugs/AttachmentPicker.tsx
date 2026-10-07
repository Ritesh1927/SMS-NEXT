"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Film, ImagePlus, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  IMAGE_EXTENSIONS, MAX_ATTACHMENTS_PER_UPLOAD, VIDEO_EXTENSIONS, attachmentKindOf, type AttachmentKind,
} from "@/lib/bugReports/constants";
import { formatBytes, uploadAttachment, type TokenGetter, type UploadedAttachment } from "@/lib/bugReports/client";

// Screenshot / screen-recording picker. Files upload the moment they're
// added (straight to Cloudinary, with progress), so submitting the form is
// instant. Supports click, drag-and-drop and paste (Ctrl+V a screenshot).

interface PickerItem {
  id: string;
  file: File;
  kind: AttachmentKind;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  uploaded?: UploadedAttachment;
  localUrl: string;
  controller?: AbortController;
}

const ACCEPT = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].map((e) => `.${e}`).join(",") + ",image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

export function AttachmentPicker({
  getToken,
  maxImageMB,
  maxVideoMB,
  onChange,
  onBusyChange,
  disabled,
  compact,
  invalid,
}: {
  getToken: TokenGetter;
  maxImageMB: number;
  maxVideoMB: number;
  /** Successfully uploaded files, in order. */
  onChange: (files: UploadedAttachment[]) => void;
  /** True while any upload is in flight (block submit). */
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  invalid?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
    onChange(items.filter((i) => i.status === "done" && i.uploaded).map((i) => i.uploaded!));
    onBusyChange?.(items.some((i) => i.status === "uploading"));
  }, [items, onChange, onBusyChange]);

  // Abort in-flight uploads and free preview memory on unmount.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => {
        i.controller?.abort();
        URL.revokeObjectURL(i.localUrl);
      });
    },
    [],
  );

  const patch = (id: string, update: Partial<PickerItem>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...update } : i)));

  const startUpload = useCallback(
    (item: PickerItem) => {
      const controller = new AbortController();
      patch(item.id, { status: "uploading", progress: 0, error: undefined, controller });
      uploadAttachment(getToken, item.file, (p) => patch(item.id, { progress: p }), controller.signal)
        .then((uploaded) => {
          URL.revokeObjectURL(uploaded.previewUrl); // we keep our own local preview URL
          patch(item.id, { status: "done", progress: 1, uploaded, controller: undefined });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          patch(item.id, { status: "error", error: err instanceof Error ? err.message : "Upload failed.", controller: undefined });
        });
    },
    [getToken],
  );

  const addFiles = (files: FileList | File[]) => {
    setRejection(null);
    const room = MAX_ATTACHMENTS_PER_UPLOAD - itemsRef.current.length;
    const accepted: PickerItem[] = [];
    for (const file of Array.from(files)) {
      if (accepted.length >= room) {
        setRejection(`You can attach up to ${MAX_ATTACHMENTS_PER_UPLOAD} files.`);
        break;
      }
      // The extension decides: it's what the server's signed upload allows.
      const kind = attachmentKindOf(file.name);
      if (!kind) {
        setRejection(`"${file.name}" isn't supported. Use JPG, PNG, WebP, MP4, MOV or WebM.`);
        continue;
      }
      const maxMB = kind === "image" ? maxImageMB : maxVideoMB;
      if (file.size > maxMB * 1024 * 1024) {
        setRejection(`"${file.name}" is ${formatBytes(file.size)}. ${kind === "image" ? "Images" : "Videos"} must be under ${maxMB} MB.`);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind,
        status: "uploading",
        progress: 0,
        localUrl: URL.createObjectURL(file),
      });
    }
    if (!accepted.length) return;
    setItems((list) => [...list, ...accepted]);
    accepted.forEach(startUpload);
  };

  const remove = (item: PickerItem) => {
    item.controller?.abort();
    URL.revokeObjectURL(item.localUrl);
    setItems((list) => list.filter((i) => i.id !== item.id));
  };

  // Paste a screenshot straight from the clipboard while the picker is mounted.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      if (!files.length) return;
      e.preventDefault();
      // Clipboard images arrive as "image.png" -- give them a useful name.
      addFiles(files.map((f, i) => new File([f], f.name && f.name !== "image.png" ? f.name : `screenshot-${Date.now()}-${i}.png`, { type: f.type })));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addFiles reads refs; re-binding per render is unnecessary
  }, [disabled, maxImageMB, maxVideoMB]);

  const full = items.length >= MAX_ATTACHMENTS_PER_UPLOAD;

  return (
    <div className="space-y-2.5">
      {!full && (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "group/drop flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed text-center transition-all",
            compact ? "px-4 py-3" : "px-5 py-6",
            dragging ? "scale-[1.01] border-primary bg-primary/[0.06]" : "border-border hover:border-primary/50 hover:bg-primary/[0.03]",
            invalid && !dragging && "border-destructive/60 bg-destructive/[0.03]",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <span className={cn("flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25 transition-transform group-hover/drop:-translate-y-0.5", compact ? "h-8 w-8" : "h-11 w-11")}>
            <UploadCloud className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </span>
          <span className="text-[13px] font-semibold text-foreground">
            Drop files, <span className="text-primary">browse</span> or paste a screenshot
          </span>
          {!compact && (
            <span className="text-[11.5px] text-muted-foreground">
              Images (JPG, PNG, WebP · up to {maxImageMB} MB) · Videos (MP4, MOV, WebM · up to {maxVideoMB} MB)
            </span>
          )}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            multiple
            disabled={disabled}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {rejection && (
        <p role="alert" className="flex items-start gap-1.5 text-[12px] text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          {rejection}
        </p>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "group/item relative aspect-[4/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border animate-in fade-in-0 zoom-in-95",
                item.status === "error" && "ring-destructive/50",
              )}
            >
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview; next/image can't optimize blob: URLs
                <img src={item.localUrl} alt={item.file.name} className="h-full w-full object-cover" />
              ) : (
                <video src={item.localUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pt-6 pb-1.5 text-white">
                <p className="flex items-center gap-1 truncate text-[11px] font-medium">
                  {item.kind === "video" ? <Film className="h-3 w-3 shrink-0" /> : <ImagePlus className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{item.file.name}</span>
                </p>
                <p className="text-[10px] text-white/75">{formatBytes(item.file.size)}</p>
              </div>

              {item.status === "uploading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-white backdrop-blur-[2px]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[11px] font-semibold">{Math.round(item.progress * 100)}%</span>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                    <div className="h-full bg-gradient-to-r from-primary to-accent transition-[width] duration-200" style={{ width: `${item.progress * 100}%` }} />
                  </div>
                </div>
              )}

              {item.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 p-2 text-center text-white">
                  <p className="line-clamp-2 text-[11px]">{item.error}</p>
                  <button
                    type="button"
                    onClick={() => startUpload(item)}
                    className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/30"
                  >
                    <RotateCcw className="h-3 w-3" /> Retry
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Remove ${item.file.name}`}
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-90 transition hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
