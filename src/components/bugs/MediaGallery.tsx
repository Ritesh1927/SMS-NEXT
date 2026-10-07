"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Film, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBytes, optimizedUrl } from "@/lib/bugReports/client";

export interface GalleryAttachment {
  url: string;
  kind: "image" | "video";
  name: string;
  bytes: number;
}

/** Thumbnails for ticket attachments; images open in a keyboard-navigable lightbox. */
export function MediaGallery({ items, size = "md" }: { items: GalleryAttachment[]; size?: "sm" | "md" }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) return null;
  const images = items.filter((i) => i.kind === "image");
  const videos = items.filter((i) => i.kind === "video");

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className={cn("grid gap-2.5", size === "sm" ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
          {images.map((item, index) => (
            <li key={item.url}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                className="group/thumb relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border transition hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Open image ${item.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- user uploads on Cloudinary, already optimized via q_auto/f_auto */}
                <img src={optimizedUrl(item.url)} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover/thumb:scale-105" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {videos.length > 0 && (
        <ul className={cn("grid gap-2.5", size === "sm" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2")}>
          {videos.map((item) => (
            <li key={item.url} className="overflow-hidden rounded-xl bg-black ring-1 ring-border">
              <video src={optimizedUrl(item.url)} controls preload="metadata" playsInline className="aspect-video w-full bg-black" />
              <div className="flex items-center justify-between gap-2 bg-card px-3 py-2 text-[11.5px]">
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <Film className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </span>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary hover:underline">
                  {formatBytes(item.bytes)} · Open
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(96vw,1200px)] gap-0 overflow-hidden bg-black/95 p-0 ring-1 ring-white/10 sm:max-w-[min(96vw,1200px)] max-lg:top-1/2 max-lg:bottom-auto max-lg:max-h-[92vh] max-lg:-translate-y-1/2 max-lg:rounded-2xl max-lg:pb-0"
          onKeyDown={(e) => {
            if (open === null) return;
            if (e.key === "ArrowRight") setOpen((open + 1) % images.length);
            if (e.key === "ArrowLeft") setOpen((open - 1 + images.length) % images.length);
          }}
        >
          {open !== null && images[open] && (
            <>
              <DialogTitle className="sr-only">{images[open].name}</DialogTitle>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-white">
                <p className="truncate text-[13px] font-medium">
                  {images[open].name} <span className="text-white/50">· {open + 1} / {images.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <a href={images[open].url} target="_blank" rel="noopener noreferrer" aria-label="Open original" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10">
                    <Download className="h-4 w-4" />
                  </a>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="relative flex max-h-[80vh] items-center justify-center bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- full-size Cloudinary original */}
                <img src={images[open].url} alt={images[open].name} className="max-h-[80vh] w-auto object-contain" />
                {images.length > 1 && (
                  <>
                    <button type="button" onClick={() => setOpen((open - 1 + images.length) % images.length)} aria-label="Previous image" className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => setOpen((open + 1) % images.length)} aria-label="Next image" className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
