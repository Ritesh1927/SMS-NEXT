"use client";

import { useCallback, useState } from "react";
import { AtSign, Code2, Loader2, Lock, MessageSquareReply, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FIELD_LIMITS, type AdminCommentType } from "@/lib/bugReports/constants";
import type { TokenGetter, UploadedAttachment } from "@/lib/bugReports/client";
import type { TeamMember } from "@/lib/bugReports/types";
import { AttachmentPicker } from "./AttachmentPicker";

export interface CommentPayload {
  type?: AdminCommentType;
  message: string;
  attachments: { publicId: string; kind: "image" | "video"; name: string }[];
  mentions?: string[];
}

const ADMIN_TYPES: { value: AdminCommentType; label: string; hint: string; icon: typeof Lock }[] = [
  { value: "reply", label: "Reply", hint: "Visible to the reporter, who is notified by email.", icon: MessageSquareReply },
  { value: "internal_note", label: "Internal note", hint: "Only the support team can see this.", icon: Lock },
  { value: "developer_note", label: "Developer note", hint: "Technical notes for the team. Never shown to the reporter.", icon: Code2 },
];

/**
 * Comment box for ticket threads.
 * - reporter: plain comment; attachments only when `allowAttachments`
 *   (the team is waiting for information).
 * - admin: Reply / Internal note / Developer note, @mentions, attachments.
 */
export function CommentComposer({
  mode,
  getToken,
  limits,
  allowAttachments,
  team = [],
  onSubmit,
  disabledReason,
}: {
  mode: "reporter" | "admin";
  getToken: TokenGetter;
  limits: { maxImageMB: number; maxVideoMB: number } | null;
  allowAttachments: boolean;
  team?: TeamMember[];
  onSubmit: (payload: CommentPayload) => Promise<void>;
  disabledReason?: string;
}) {
  const [type, setType] = useState<AdminCommentType>("reply");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<UploadedAttachment[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentions, setMentions] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const onFiles = useCallback((f: UploadedAttachment[]) => setFiles(f), []);

  if (disabledReason) {
    return <p className="rounded-xl bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">{disabledReason}</p>;
  }

  const activeType = ADMIN_TYPES.find((t) => t.value === type)!;
  const canAttach = mode === "admin" || allowAttachments;

  const submit = async () => {
    const text = message.trim();
    if (!text) {
      setError("Write a message first.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSubmit({
        type: mode === "admin" ? type : undefined,
        message: text,
        attachments: files.map(({ publicId, kind, name }) => ({ publicId, kind, name })),
        mentions: mode === "admin" ? mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id) : undefined,
      });
      setMessage("");
      setMentions([]);
      setFiles([]);
      setShowFiles(false);
      setPickerKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  };

  const addMention = (member: TeamMember) => {
    setMentions((m) => (m.some((x) => x.id === member.id) ? m : [...m, member]));
    setMessage((msg) => `${msg}${msg && !msg.endsWith(" ") ? " " : ""}@${member.name} `);
  };

  return (
    <div
      className={cn(
        "rounded-2xl ring-1 transition-colors",
        mode === "admin" && type === "internal_note" ? "bg-amber-500/[0.04] ring-amber-500/25" : mode === "admin" && type === "developer_note" ? "bg-slate-500/[0.04] ring-slate-500/25" : "bg-card ring-border",
      )}
    >
      {mode === "admin" && (
        <div role="tablist" aria-label="Comment type" className="flex gap-1 border-b border-border/70 p-1.5">
          {ADMIN_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition",
                type === t.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
        }}
        maxLength={FIELD_LIMITS.comment.max}
        rows={3}
        placeholder={mode === "admin" ? (type === "reply" ? "Write a reply to the reporter…" : "Write a note for the team… (@ to mention)") : "Add a comment or more details…"}
        aria-label="Comment"
        className="min-h-24 resize-y rounded-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
      />

      {showFiles && canAttach && limits && (
        <div className="px-3 pb-3">
          <AttachmentPicker key={pickerKey} getToken={getToken} maxImageMB={limits.maxImageMB} maxVideoMB={limits.maxVideoMB} onChange={onFiles} onBusyChange={setUploading} compact />
        </div>
      )}

      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {mentions.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              @{m.name}
              <button type="button" aria-label={`Remove mention ${m.name}`} onClick={() => setMentions((x) => x.filter((y) => y.id !== m.id))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-3 py-2">
        {canAttach && (
          <Button type="button" variant="ghost" size="sm" className="rounded-lg text-muted-foreground" onClick={() => setShowFiles((s) => !s)} aria-expanded={showFiles}>
            <Paperclip /> {files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "Attach"}
          </Button>
        )}
        {mode === "admin" && team.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="sm" className="rounded-lg text-muted-foreground" />}>
              <AtSign /> Mention
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {team.filter((m) => !m.isMe).map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => addMention(m)} className="flex-col items-start gap-0">
                  <span className="text-[13px] font-medium">{m.name}</span>
                  <span className="text-[11px] text-muted-foreground">{m.email}</span>
                </DropdownMenuItem>
              ))}
              {team.filter((m) => !m.isMe).length === 0 && <p className="px-2 py-1.5 text-[12px] text-muted-foreground">No other team members.</p>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <p className="hidden min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground sm:block">
          {mode === "admin" ? activeType.hint : canAttach ? "The team asked for more information. You can attach files." : "Ctrl + Enter to send"}
        </p>
        <Button type="button" size="sm" onClick={submit} disabled={sending || uploading} className="ml-auto rounded-lg bg-gradient-to-r from-primary to-accent font-semibold">
          {sending || uploading ? <Loader2 className="animate-spin" /> : <Send />}
          {uploading ? "Uploading…" : mode === "admin" && type !== "reply" ? "Add note" : "Send"}
        </Button>
      </div>
      {error && <p role="alert" className="px-4 pb-2.5 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
