"use client";

import { useEffect, useState } from "react";
import { Trophy, Flame, Medal, Users, Star, Zap } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/PageLoader";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";

interface Row {
  rank: number;
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  points: number;
  streakDays: number;
  badges: string[];
}

interface LeaderboardResponse {
  success: boolean;
  data: Row[];
  star: Row | null;
}

const RANK_STYLE: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-slate-400",
  3: "text-amber-700",
};

const RANK_BADGE: Record<number, { color: string; colorDark: string }> = {
  1: { color: "#EAB308", colorDark: "#CA8A04" },
  2: { color: "#94A3B8", colorDark: "#64748B" },
  3: { color: "#B45309", colorDark: "#92400E" },
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [star, setStar] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<LeaderboardResponse>("/leaderboard", token)
      .then((res) => {
        setRows(res.data);
        setStar(res.star);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leaderboard."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader icon={Trophy} title="Leaderboard" subtitle="Top students ranked by points earned from attendance, exams, fees and homework." accent="fuchsia" />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <PageLoader label="Loading leaderboard..." />
      ) : (
        <>
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatFilterCard icon={Users} color="#4F46E5" colorDark="#4338CA" value={rows.length} label="Ranked Students" />
          <StatFilterCard icon={Star} color="#EAB308" colorDark="#CA8A04" value={rows[0]?.points ?? 0} label="Top Score" sublabel={rows[0] ? rows[0].name : undefined} />
          <StatFilterCard icon={Zap} color="#F59E0B" colorDark="#D97706" value={Math.max(0, ...rows.map((r) => r.streakDays))} label="Longest Streak (days)" />
        </div>
      )}

      {star && (
        <Card className="border-warning/30 bg-gradient-to-br from-warning/10 to-white">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-warning">Star Student</p>
              <p className="text-base font-bold text-foreground">
                {star.name} <span className="font-normal text-muted-foreground">· {star.class}{star.section ? `-${star.section}` : ""}</span>
              </p>
              <p className="text-sm text-muted-foreground">{star.points} pts · {star.streakDays} day streak</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState icon={Trophy} message="No points earned yet." />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const badge = RANK_BADGE[r.rank];
                return (
                <div key={r._id} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/40">
                  <div className="w-8 shrink-0 flex items-center justify-center">
                    {badge ? (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${badge.color}, ${badge.colorDark})` }}
                      >
                        <Medal className="h-4 w-4" />
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">{r.rank}</span>
                    )}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.class}{r.section ? `-${r.section}` : ""} · {r.studentId}
                    </p>
                  </div>
                  {r.streakDays > 0 && (
                    <div className="flex items-center gap-1 text-xs text-warning font-medium">
                      <Flame className="h-3.5 w-3.5" /> {r.streakDays}
                    </div>
                  )}
                  <div className="text-sm font-bold text-primary w-16 text-right">{r.points} pts</div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
