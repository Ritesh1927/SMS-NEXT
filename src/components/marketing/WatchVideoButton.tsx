"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BRAND } from "./content";
import { BTN_SECONDARY } from "./styles";

/**
 * "Watch Video": opens the demo video when BRAND.demoVideoUrl is set.
 * Without one it scrolls to the interactive dashboard tour instead of
 * opening an empty player.
 */
export function WatchVideoButton() {
  const [open, setOpen] = useState(false);
  const hasVideo = Boolean(BRAND.demoVideoUrl);

  if (!hasVideo) {
    return (
      <a href="#features" className={BTN_SECONDARY}>
        <PlayCircle className="h-5 w-5 text-primary" /> See It in Action
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BTN_SECONDARY}>
        <PlayCircle className="h-5 w-5 text-primary" /> Watch Video
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(94vw,960px)] gap-0 overflow-hidden bg-black p-0 sm:max-w-[min(94vw,960px)] max-lg:top-1/2 max-lg:bottom-auto max-lg:-translate-y-1/2 max-lg:rounded-2xl max-lg:pb-0">
          <DialogTitle className="sr-only">{BRAND.name} product video</DialogTitle>
          {open && (
            <iframe
              src={BRAND.demoVideoUrl}
              title={`${BRAND.name} product video`}
              className="aspect-video w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
