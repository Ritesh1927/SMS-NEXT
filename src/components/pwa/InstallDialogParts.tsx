"use client";

import type { ComponentType, ReactNode } from "react";

export interface InstallStep {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text?: string;
}

/** Numbered step list used by every manual guide (iOS, browser menu, open app). */
export function InstallSteps({ steps }: { steps: readonly InstallStep[] }) {
  return (
    <ol className="space-y-1 px-5 pt-5 pb-2">
      {steps.map(({ icon: Icon, title, text }, index) => (
        <InstallListRow
          key={title}
          index={index}
          title={steps.length > 1 ? `${index + 1}. ${title}` : title}
          text={text}
          icon={<Icon className="h-[18px] w-[18px]" />}
        />
      ))}
    </ol>
  );
}

// Building blocks shared by the native install dialog and the iOS/Safari
// guide, so both variants look identical apart from their content.

/** Icon + title + one-line description; fades in with a small stagger. */
export function InstallListRow({ icon, title, text, index }: { icon: ReactNode; title: string; text?: string; index: number }) {
  return (
    <li
      className="flex animate-in items-center gap-3.5 rounded-xl px-2 py-2 duration-500 fill-mode-both fade-in-0 slide-in-from-bottom-2"
      style={{ animationDelay: `${150 + index * 70}ms` }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        {text && <span className="block text-[12.5px] leading-snug text-muted-foreground">{text}</span>}
      </span>
    </li>
  );
}

/** Button row; stacks full-width on phones, where the dialog is a bottom sheet. */
export function InstallFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 px-5 pt-3 pb-5 sm:flex-row sm:justify-end max-lg:pb-[calc(1.25rem+env(safe-area-inset-bottom))] [&>button]:max-sm:w-full">
      {children}
    </div>
  );
}

/** Brand-gradient primary action used by both dialog variants. */
export const INSTALL_PRIMARY_BUTTON_CLASS =
  "h-11 rounded-xl bg-gradient-to-r from-primary to-accent px-6 font-semibold shadow-lg shadow-primary/30 transition-[opacity,box-shadow] hover:opacity-95 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-offset-popover";

/** Quiet secondary action ("Continue in Browser") paired with the primary. */
export const SECONDARY_BUTTON_CLASS = "h-11 rounded-xl px-5 font-semibold text-muted-foreground hover:text-foreground";

export const CONTINUE_IN_BROWSER = "Continue in Browser";
