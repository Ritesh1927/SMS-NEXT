"use client";

import type { ComponentType } from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Row for the top-bar profile dropdown: icon tile, title, one-line hint.
 * Built on the Base UI menu item directly rather than DropdownMenuItem,
 * whose focus style floods the whole row with the accent color and forces
 * every child to white -- too heavy for a two-line row with colored icons.
 * Keyboard navigation and close-on-select still come from the primitive.
 */
export function ProfileMenuItem({
  icon: Icon,
  title,
  description,
  onClick,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <MenuPrimitive.Item
      onClick={onClick}
      className={cn(
        "group/profile-item flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 outline-none select-none transition-colors",
        danger ? "data-highlighted:bg-destructive/[0.07]" : "data-highlighted:bg-primary/[0.06]",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
          danger
            ? "bg-destructive/10 text-destructive group-data-highlighted/profile-item:bg-destructive group-data-highlighted/profile-item:text-white"
            : "bg-primary/10 text-primary group-data-highlighted/profile-item:bg-gradient-to-br group-data-highlighted/profile-item:from-primary group-data-highlighted/profile-item:to-accent group-data-highlighted/profile-item:text-white group-data-highlighted/profile-item:shadow-md group-data-highlighted/profile-item:shadow-primary/25",
        )}
      >
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[13.5px] leading-tight font-semibold", danger ? "text-destructive" : "text-foreground")}>
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-muted-foreground">{description}</span>
        )}
      </span>
      {!danger && (
        <ChevronRight className="h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground/60 opacity-0 transition-all duration-200 group-data-highlighted/profile-item:translate-x-0 group-data-highlighted/profile-item:opacity-100" />
      )}
    </MenuPrimitive.Item>
  );
}
