"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle, Search, Users, GraduationCap, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";

const ROLE_PALETTE: Record<Contact["role"], { color: string; colorDark: string }> = {
  schooladmin: { color: "#4F46E5", colorDark: "#4338CA" },
  teacher: { color: "#8B5CF6", colorDark: "#7C3AED" },
  parent: { color: "#0EA5E9", colorDark: "#0284C7" },
};

interface Contact {
  id: string;
  name: string;
  role: "schooladmin" | "teacher" | "parent";
  subtitle: string;
  conversationId: string | null;
  lastMessage: string;
  time: string | null;
  unread: number;
  targetUserId: string;
  targetRole: "schooladmin" | "teacher" | "parent";
  childId: string | null;
}

interface MessageRow {
  _id: string;
  sender: string;
  senderRole: string;
  senderName: string;
  text: string;
  createdAt: string;
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ContactsResponse {
  success: boolean;
  contacts: Contact[];
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface MessagesResponse {
  success: boolean;
  messages: MessageRow[];
}

interface ConversationResponse {
  success: boolean;
  conversationId: string;
}

interface SendResponse {
  success: boolean;
  message?: MessageRow;
}

const POLL_MS = 4000;

export default function ChatPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Contact | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);

  // Admin: null = "recent conversations" (default); "teacher"/"student" =
  // browsing/searching to start a new one. Teacher: search is a client-side
  // filter over its already-scoped (and always small) contact list. Parent
  // has no search at all — the set is fixed (class teacher(s) + admin).
  const [filterType, setFilterType] = useState<"teacher" | "student" | null>(null);
  const [search, setSearch] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classFilter, setClassFilter] = useState("");

  const loadContacts = () => {
    const token = getToken();
    if (!token) return;
    let path = "/chat/contacts";
    if (user?.role === "schooladmin" && filterType) {
      const params = new URLSearchParams({ type: filterType });
      if (search.trim()) params.set("search", search.trim());
      if (filterType === "student") {
        if (!classFilter) {
          setContacts([]);
          return;
        }
        const [name, section] = classFilter.split("::");
        params.set("class", name);
        params.set("section", section || "");
      }
      path = `/chat/contacts?${params.toString()}`;
    }
    apiGet<ContactsResponse>(path, token)
      .then((res) => setContacts(res.contacts))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contacts."));
  };

  useEffect(() => {
    if (user?.role === "schooladmin" && filterType === "student" && classes.length === 0) {
      const token = getToken();
      if (token) apiGet<ClassesResponse>("/classes", token).then((res) => setClasses(res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reload + refetch whenever the filter changes.
    loadContacts();
    const interval = setInterval(loadContacts, POLL_MS * 3);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, classFilter]);

  // Debounce the search box for schooladmin's server-side search.
  useEffect(() => {
    if (user?.role !== "schooladmin" || !filterType) return;
    const timeout = setTimeout(loadContacts, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const visibleContacts =
    user?.role === "teacher" && search.trim()
      ? (contacts || []).filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
      : contacts;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const openContact = async (contact: Contact) => {
    setActive(contact);
    setMessages([]);
    setLoadingThread(true);
    lastTimestampRef.current = null;
    const token = getToken();
    if (!token) return;
    try {
      let convId = contact.conversationId;
      if (!convId) {
        const res = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            targetUserId: contact.targetUserId,
            targetRole: contact.targetRole,
            childId: contact.childId,
          }),
        });
        const json: ConversationResponse & { message?: string } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to open conversation.");
        convId = json.conversationId;
      }
      setConversationId(convId);
      const msgRes = await apiGet<MessagesResponse>(`/chat/conversations/${convId}/messages`, token);
      setMessages(msgRes.messages);
      if (msgRes.messages.length > 0) {
        lastTimestampRef.current = msgRes.messages[msgRes.messages.length - 1].createdAt;
      }
      loadContacts();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to open conversation." });
    } finally {
      setLoadingThread(false);
    }
  };

  // Poll for new messages while a thread is open.
  useEffect(() => {
    if (!conversationId) return;
    const token = getToken();
    if (!token) return;

    const tick = async () => {
      const after = lastTimestampRef.current;
      const url = after ? `/chat/conversations/${conversationId}/messages?after=${encodeURIComponent(after)}` : null;
      if (!url) return;
      try {
        const res = await apiGet<MessagesResponse>(url, token);
        if (res.messages.length > 0) {
          setMessages((prev) => [...prev, ...res.messages]);
          lastTimestampRef.current = res.messages[res.messages.length - 1].createdAt;
        }
      } catch {
        // Silent — transient poll failures shouldn't interrupt the chat.
      }
    };

    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [conversationId]);

  const handleSend = async () => {
    if (!draft.trim() || !conversationId) return;
    const token = getToken();
    if (!token) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const json: SendResponse = await res.json();
      if (!res.ok || !json.success) throw new Error("Failed to send message.");
      if (json.message) {
        setMessages((prev) => [...prev, json.message as MessageRow]);
        lastTimestampRef.current = json.message.createdAt;
      }
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to send message." });
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  const isAdmin = user.role === "schooladmin";
  const isTeacher = user.role === "teacher";

  return (
    <div>
      <PageHeader icon={MessageCircle} title="Communication" subtitle="Message teachers, students and parents." accent="amber" className="mb-6" />
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden flex h-[70vh]">
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        {isAdmin && (
          <div className="px-3 py-2.5 border-b border-border space-y-2">
            <div className="inline-flex w-full items-center gap-1 rounded-full border border-border/60 bg-muted/60 p-1 text-muted-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
              <button
                onClick={() => {
                  setFilterType((t) => (t === "teacher" ? null : "teacher"));
                  setSearch("");
                }}
                className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-full px-2 py-1.5 transition-all duration-300 ${
                  filterType === "teacher"
                    ? "bg-gradient-to-br from-primary to-accent text-white shadow-[0_4px_10px_-2px_rgba(79,70,229,0.45)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                }`}
              >
                <GraduationCap className="h-3 w-3" /> Teachers
              </button>
              <button
                onClick={() => {
                  setFilterType((t) => (t === "student" ? null : "student"));
                  setSearch("");
                }}
                className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-full px-2 py-1.5 transition-all duration-300 ${
                  filterType === "student"
                    ? "bg-gradient-to-br from-primary to-accent text-white shadow-[0_4px_10px_-2px_rgba(79,70,229,0.45)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                }`}
              >
                <Users className="h-3 w-3" /> Students
              </button>
            </div>
            {filterType === "student" && (
              <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "")}>
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={`${c.name}::${c.section}`}>
                      Class {c.name}-{c.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filterType && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={filterType === "teacher" ? "Search teachers by name..." : "Search students by name..."}
                  className="h-8 pl-8 pr-7 text-xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isTeacher && (
          <div className="px-3 py-2.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="h-8 pl-8 pr-7 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {error && <p className="text-xs text-red-600 px-4 py-2">{error}</p>}
          {error ? null : !visibleContacts ? (
            <PageLoader compact label="Loading contacts..." />
          ) : isAdmin && filterType === "student" && !classFilter ? (
            <p className="text-xs text-muted-foreground px-4 py-3">Pick a class above to search students.</p>
          ) : visibleContacts.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">
              {isAdmin && filterType ? "No matches." : "No contacts yet."}
            </p>
          ) : (
            visibleContacts.map((c, i) => (
              <button
                key={`${c.targetUserId}-${c.childId || ""}-${i}`}
                onClick={() => openContact(c)}
                className={`w-full flex items-center gap-2.5 text-left px-4 py-3 border-b border-border transition-colors ${
                  active?.targetUserId === c.targetUserId && active?.childId === c.childId ? "bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, ${ROLE_PALETTE[c.role].color}, ${ROLE_PALETTE[c.role].colorDark})` }}
                >
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                    {c.unread > 0 && (
                      <span className="text-[10px] font-bold text-primary-foreground bg-primary rounded-full px-1.5 py-0.5 shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.subtitle}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="icon-chip h-14 w-14 bg-primary/8 mb-3">
              <MessageCircle className="h-6 w-6 text-primary/60" />
            </div>
            <p className="text-sm">Select a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                style={{ background: `linear-gradient(135deg, ${ROLE_PALETTE[active.role].color}, ${ROLE_PALETTE[active.role].colorDark})` }}
              >
                {active.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{active.name}</p>
                <p className="text-xs text-muted-foreground truncate">{active.subtitle}</p>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingThread ? (
                <PageLoader label="Loading messages..." />
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderRole === user.role && m.sender === user.id;
                  return (
                    <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 px-4 py-3 border-t border-border"
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
                maxLength={2000}
              />
              <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
