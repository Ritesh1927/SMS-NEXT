"use client";

import { useEffect, useState } from "react";
import { Trophy, Flame, Medal } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

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
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <>
      {star && (
        <Card className="border-[#FDE68A] bg-gradient-to-br from-[#FFFBEB] to-white">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="h-12 w-12 rounded-full bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#B45309]">Star Student</p>
              <p className="text-base font-bold text-[#172554]">
                {star.name} <span className="font-normal text-[#64748B]">· {star.class}{star.section ? `-${star.section}` : ""}</span>
              </p>
              <p className="text-sm text-[#64748B]">{star.points} pts · {star.streakDays} day streak</p>
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
            <div className="divide-y divide-[#E2E8F0]">
              {rows.map((r) => (
                <div key={r._id} className="flex items-center gap-4 px-6 py-3">
                  <div className={`w-6 text-center font-bold ${RANK_STYLE[r.rank] || "text-[#64748B]"}`}>
                    {r.rank <= 3 ? <Medal className="h-5 w-5 mx-auto" /> : r.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#172554] truncate">{r.name}</p>
                    <p className="text-xs text-[#64748B]">
                      {r.class}{r.section ? `-${r.section}` : ""} · {r.studentId}
                    </p>
                  </div>
                  {r.streakDays > 0 && (
                    <div className="flex items-center gap-1 text-xs text-[#F59E0B] font-medium">
                      <Flame className="h-3.5 w-3.5" /> {r.streakDays}
                    </div>
                  )}
                  <div className="text-sm font-bold text-[#4F46E5] w-16 text-right">{r.points} pts</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
