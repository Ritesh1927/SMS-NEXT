"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, LifeBuoy, Loader2, School, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { saRequest, setPendingAction, SA_PENDING_ACTION_EVENT, type SchoolRecord } from "@/lib/superAdminApi";
import { StatusBadge } from "@/components/bugs/TicketBadges";
import { SA_ALL_ITEMS } from "./nav";

interface Result {
  id: string;
  group: "Pages" | "Schools" | "Tickets";
  label: string;
  hint?: ReactNode;
  icon: typeof Search;
  run: () => void;
}

interface TicketHit {
  _id: string;
  ticketNumber: string;
  title: string;
  status: string;
}

/**
 * Global search (Ctrl/⌘ + K): pages instantly, schools and tickets from the
 * existing search endpoints (debounced). Arrow keys + Enter, Esc to close.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [tickets, setTickets] = useState<TicketHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim();

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setSchools([]);
    setTickets([]);
  };

  // Remote results, debounced; stale responses are ignored.
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        saRequest<{ data: SchoolRecord[] }>(`/superadmin/schools?search=${encodeURIComponent(q)}`).then((r) => r.data ?? []).catch(() => []),
        saRequest<{ data: TicketHit[] }>(`/superadmin/tickets?search=${encodeURIComponent(q)}&limit=5&archived=`).then((r) => r.data ?? []).catch(() => []),
      ]).then(([s, t]) => {
        if (cancelled) return;
        setSchools(s.slice(0, 5));
        setTickets(t.slice(0, 5));
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  const results = useMemo<Result[]>(() => {
    const lower = q.toLowerCase();
    const pages: Result[] = SA_ALL_ITEMS.filter(
      (i) => !lower || i.label.toLowerCase().includes(lower) || i.description.toLowerCase().includes(lower),
    ).map((i) => ({
      id: `page:${i.href}`,
      group: "Pages",
      label: i.label,
      hint: i.description,
      icon: i.icon,
      run: () => router.push(i.href),
    }));
    if (q.length < 2) return pages;
    return [
      ...pages,
      ...schools.map<Result>((s) => ({
        id: `school:${s._id}`,
        group: "Schools",
        label: s.name,
        hint: `${s.code} · ${s.adminEmail}`,
        icon: School,
        run: () => {
          setPendingAction({ type: "search-schools", query: s.name });
          window.dispatchEvent(new Event(SA_PENDING_ACTION_EVENT));
          router.push("/super-admin/schools");
        },
      })),
      ...tickets.map<Result>((t) => ({
        id: `ticket:${t._id}`,
        group: "Tickets",
        label: `${t.ticketNumber} · ${t.title}`,
        hint: <StatusBadge status={t.status} />,
        icon: LifeBuoy,
        run: () => router.push(`/super-admin/tickets/${t._id}`),
      })),
    ];
  }, [q, schools, tickets, router]);

  const shown = results;
  const activeIndex = Math.min(active, Math.max(0, shown.length - 1));

  const runAt = (index: number) => {
    const r = shown[index];
    if (!r) return;
    close();
    r.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(1, shown.length);
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(activeIndex);
    }
  };

  let lastGroup: string | null = null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] max-h-[76vh] translate-y-0 gap-0 overflow-hidden p-0 shadow-[0_40px_90px_-30px_rgba(37,30,140,0.5)] ring-1 ring-border sm:max-w-xl max-lg:top-auto max-lg:pb-0"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search pages, schools and tickets</DialogDescription>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, schools, tickets…"
            aria-label="Search"
            aria-controls="sa-command-results"
            className="h-14 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">Esc</kbd>
        </div>

        <div ref={listRef} id="sa-command-results" role="listbox" className="max-h-[56vh] overflow-y-auto p-2">
          {shown.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
              {loading ? "Searching…" : `No results for “${q}”.`}
            </p>
          ) : (
            shown.map((r, index) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              return (
                <div key={r.id}>
                  {header && <p className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">{header}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => runAt(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      index === activeIndex ? "bg-primary/[0.08] text-foreground" : "text-foreground/85",
                    )}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", index === activeIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <r.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{r.label}</span>
                      {r.hint && <span className="block truncate text-[12px] text-muted-foreground">{r.hint}</span>}
                    </span>
                    {index === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span className="ml-auto">Type 2+ letters to search schools & tickets</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
