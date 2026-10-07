"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronDown, Search, Gauge, UsersRound, GraduationCap, NotebookPen, Wallet, MessageCircle, TrendingUp, ShieldCheck, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import type { NavSection } from "@/config/mobileNav";
import { useSheetSnap } from "@/hooks/useSheetSnap";

// A distinct icon + gradient tint per section -- reads noticeably richer
// than one flat primary-tinted chip repeated eight times, same idea as the
// tinted Quick Actions cards.
const SECTION_STYLE: Record<string, { icon: LucideIcon; gradient: string }> = {
  Overview: { icon: Gauge, gradient: "from-primary to-accent" },
  People: { icon: UsersRound, gradient: "from-sky-500 to-blue-500" },
  "My Classes": { icon: GraduationCap, gradient: "from-indigo-500 to-blue-500" },
  Academics: { icon: NotebookPen, gradient: "from-violet-500 to-purple-500" },
  Finance: { icon: Wallet, gradient: "from-amber-500 to-orange-500" },
  Communication: { icon: MessageCircle, gradient: "from-rose-500 to-pink-500" },
  Insights: { icon: TrendingUp, gradient: "from-emerald-500 to-teal-500" },
  Administration: { icon: ShieldCheck, gradient: "from-slate-700 to-slate-900" },
};
const DEFAULT_SECTION_STYLE = { icon: Gauge, gradient: "from-primary to-accent" };

export function MobileModulesDrawer({
  open,
  onOpenChange,
  sections,
  unreadChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSection[];
  unreadChat: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set<string>());
  const [touched, setTouched] = useState(false);
  // Swipe the handle up to expand to full height, down to collapse / close.
  const sheet = useSheetSnap({ open, onClose: () => onOpenChange(false) });

  // Auto-expand the section containing the current page the first time real
  // (permission-filtered) sections arrive. Set during render rather than an
  // effect -- an effect would paint fully-collapsed first, then pop open a
  // frame later. `touched` stops this from re-collapsing a section the user
  // has since closed by hand.
  const defaultOpenSection = sections.find((s) => s.items.some((i) => i.href === pathname))?.section ?? sections[0]?.section;
  if (!touched && defaultOpenSection && !openSections.has(defaultOpenSection)) {
    setOpenSections(new Set([defaultOpenSection]));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({ section: s.section, items: s.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0);
  }, [sections, query]);

  const toggleSection = (section: string) => {
    setTouched(true);
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-t-[26px] border-none p-0"
        style={sheet.sheetStyle}
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/70 px-4 pb-3">
          {/* Drag area: handle + title row. The search box below stays out of it. */}
          <div {...sheet.handleProps} className="-mx-4 cursor-grab touch-none px-4 pt-2.5 select-none active:cursor-grabbing">
            <button
              type="button"
              onClick={sheet.toggle}
              aria-label={sheet.snap === "peek" ? "Expand modules" : "Collapse modules"}
              className="mx-auto mb-2.5 flex h-4 w-16 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={`block h-1.5 rounded-full bg-border transition-all duration-200 ${sheet.isDragging ? "w-14 bg-muted-foreground/40" : "w-10"}`} />
            </button>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Modules</h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules..."
              className="h-11 rounded-2xl bg-muted/60 pl-10 shadow-inner"
            />
          </div>
        </div>

        <div {...sheet.listProps} className="flex-1 overflow-y-auto overscroll-contain px-3 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No modules match &quot;{query}&quot;.</p>
          )}
          {filtered.map(({ section, items }) => {
            const { icon: SectionIcon, gradient } = SECTION_STYLE[section] || DEFAULT_SECTION_STYLE;
            const isOpen = query.trim().length > 0 || openSections.has(section);
            return (
              <div key={section} className="mb-2 overflow-hidden rounded-2xl border border-border/60 bg-card">
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-muted/50"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
                    <SectionIcon className="h-4.5 w-4.5" />
                  </span>
                  <span className="flex-1 text-[13px] font-bold uppercase tracking-wide text-foreground/80">{section}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-1 px-2.5 pb-2.5">
                      {items.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => go(item.href)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors active:scale-[0.98] ${
                              isActive ? "bg-primary/10 text-primary" : "text-foreground/85 hover:bg-muted/60"
                            }`}
                          >
                            <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge === "unread" && unreadChat > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {unreadChat > 9 ? "9+" : unreadChat}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
