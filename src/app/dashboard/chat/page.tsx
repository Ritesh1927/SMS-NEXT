"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface ContactsResponse {
  success: boolean;
  contacts: Contact[];
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

  const loadContacts = () => {
    const token = getToken();
    if (!token) return;
    apiGet<ContactsResponse>("/chat/contacts", token)
      .then((res) => setContacts(res.contacts))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contacts."));
  };

  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, POLL_MS * 3);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden flex h-[70vh]">
      <div className="w-64 shrink-0 border-r border-[#F1F5F9] overflow-y-auto">
        <div className="px-4 py-3 border-b border-[#F1F5F9]">
          <h1 className="text-sm font-semibold text-[#172554]">Communication</h1>
        </div>
        {error && <p className="text-xs text-red-600 px-4 py-2">{error}</p>}
        {error ? null : !contacts ? (
          <div className="flex items-center gap-2 text-xs text-[#64748B] px-4 py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-xs text-[#64748B] px-4 py-3">No contacts yet.</p>
        ) : (
          contacts.map((c) => (
            <button
              key={`${c.targetUserId}-${c.childId || ""}`}
              onClick={() => openContact(c)}
              className={`w-full text-left px-4 py-3 border-b border-[#F1F5F9] transition-colors ${
                active?.targetUserId === c.targetUserId && active?.childId === c.childId ? "bg-[#4F46E5]/5" : "hover:bg-[#F8FAFC]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#172554] truncate">{c.name}</p>
                {c.unread > 0 && (
                  <span className="text-[10px] font-bold text-white bg-[#4F46E5] rounded-full px-1.5 py-0.5 shrink-0">
                    {c.unread}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748B] truncate mt-0.5">{c.lastMessage || c.subtitle}</p>
            </button>
          ))
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#94A3B8]">
            <MessageCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Select a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-[#F1F5F9]">
              <p className="text-sm font-semibold text-[#172554]">{active.name}</p>
              <p className="text-xs text-[#64748B]">{active.subtitle}</p>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingThread ? (
                <div className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">No messages yet. Say hello!</p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderRole === user.role && m.sender === user.id;
                  return (
                    <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine ? "bg-[#4F46E5] text-white" : "bg-[#F1F5F9] text-[#172554]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-[#94A3B8]"}`}>
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
              className="flex items-center gap-2 px-4 py-3 border-t border-[#F1F5F9]"
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
                maxLength={2000}
              />
              <Button type="submit" size="icon" disabled={sending || !draft.trim()} className="bg-[#4F46E5] hover:bg-[#4338CA]">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
