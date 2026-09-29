"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Megaphone, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getToken, type AuthUser } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

interface NoticeItem {
  _id: string;
  title: string;
  content: string;
  isUrgent: boolean;
  isPinned: boolean;
  createdAt: string;
}

interface NoticesResponse {
  success: boolean;
  data: NoticeItem[];
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayBucket(dateStr: string): "Today" | "Yesterday" | "Earlier" {
  const d = new Date(dateStr);
  const now = new Date();
  if (isSameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  return "Earlier";
}

type Filter = "all" | "unread" | "today";

function NotificationRow({
  notice,
  unread,
  onOpen,
  onDismiss,
}: {
  notice: NoticeItem;
  unread: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    setDragX(Math.min(0, Math.max(delta, -140)));
  };
  const endDrag = () => {
    setDragging(false);
    if (dragX < -80) {
      setDragX(-400);
      setTimeout(onDismiss, 150);
    } else {
      setDragX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex items-center justify-end bg-destructive/90 px-5">
        <span className="text-xs font-bold text-white">Dismiss</span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 200ms ease-out" }}
        className={`relative flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-card px-3.5 py-3 text-left touch-pan-y ${unread ? "bg-primary/5" : ""}`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
            notice.isUrgent ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-primary to-accent"
          }`}
        >
          {notice.isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[13.5px] truncate ${unread ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>{notice.title}</p>
            {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notice.content}</p>
          <p className="mt-1 text-[10.5px] text-muted-foreground/70">{timeAgo(notice.createdAt)}</p>
        </div>
      </button>
    </div>
  );
}

export function MobileNotificationPanel({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
}) {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  // Same storage key DashboardTopBar's bell uses, so "seen" state stays in
  // sync whichever surface (desktop bell or this panel) the user last used.
  const lastSeenKey = `notif_lastSeen_${user.id}`;
  const dismissedKey = `notif_dismissed_${user.id}`;

  useEffect(() => {
    if (!open) return;
    const token = getToken();
    if (!token) return;
    apiGet<NoticesResponse>("/notices", token)
      .then((res) => setNotices(res.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reading the "seen" cutoff and dismissed-id set from localStorage (an external system) fresh each time the panel opens.
    setLastSeen(localStorage.getItem(lastSeenKey));
    try {
      const raw = localStorage.getItem(dismissedKey);
      setDismissed(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch {
      setDismissed(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isNew = (n: NoticeItem) => !lastSeen || new Date(n.createdAt) > new Date(lastSeen);

  const visible = useMemo(() => notices.filter((n) => !dismissed.has(n._id)), [notices, dismissed]);

  const filteredList = useMemo(() => {
    if (filter === "unread") return visible.filter(isNew);
    if (filter === "today") return visible.filter((n) => dayBucket(n.createdAt) === "Today");
    return visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, filter, lastSeen]);

  const grouped = useMemo(() => {
    const buckets: Record<"Today" | "Yesterday" | "Earlier", NoticeItem[]> = { Today: [], Yesterday: [], Earlier: [] };
    for (const n of filteredList) buckets[dayBucket(n.createdAt)].push(n);
    return buckets;
  }, [filteredList]);

  const unreadCount = visible.filter(isNew).length;

  const markAllSeen = () => {
    if (notices.length === 0) return;
    const newest = notices.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), notices[0].createdAt);
    localStorage.setItem(lastSeenKey, newest);
    setLastSeen(newest);
  };

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem(dismissedKey, JSON.stringify([...next]));
      return next;
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) markAllSeen();
    onOpenChange(next);
  };

  const openNotice = () => {
    markAllSeen();
    onOpenChange(false);
    router.push("/dashboard/notices");
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="flex h-[92vh] flex-col gap-0 rounded-t-[26px] border-none p-0">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/70 px-4 pb-3 pt-2.5">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Notifications</h2>
              {unreadCount > 0 && <p className="text-xs font-semibold text-primary">{unreadCount} new</p>}
            </div>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          <div className="flex gap-2">
            {(["all", "unread", "today"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">Nothing here.</p>
            </div>
          ) : (
            (["Today", "Yesterday", "Earlier"] as const).map((bucket) =>
              grouped[bucket].length > 0 ? (
                <div key={bucket} className="mb-4">
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{bucket}</p>
                  <div className="flex flex-col gap-2">
                    {grouped[bucket].map((n) => (
                      <NotificationRow key={n._id} notice={n} unread={isNew(n)} onOpen={openNotice} onDismiss={() => dismiss(n._id)} />
                    ))}
                  </div>
                </div>
              ) : null,
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
