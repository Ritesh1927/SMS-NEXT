"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Award, BookOpen, BarChart3, Users } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar,
} from "recharts";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

interface ProgressData {
  overallGPA: string;
  rank: string;
  subjectCount: number;
  avgScore: string;
  performanceTrend: { month: string; score: number }[];
  subjectData: { subject: string; score: number; classAvg: number; grade: string }[];
  remarks: { date: string; teacher: string; subject: string; remark: string; positive: boolean }[];
  hasResults: boolean;
}

interface Child {
  _id: string;
  name: string;
}

export default function ProgressPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { children: Child[] } }>("/dashboard/parent", token)
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setSelectedChildId(res.data.children[0]._id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ProgressData }>(`/progress/student/${selectedChildId}`, token)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  const performanceTrend = data?.performanceTrend || [];
  const subjectData = data?.subjectData || [];
  const radarData = subjectData.map((s) => ({ subject: s.subject, student: s.score, classAvg: s.classAvg }));
  const remarks = data?.remarks || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader icon={TrendingUp} title="Progress Tracking" subtitle="Detailed insights into academic performance and growth." accent="fuchsia" />
        {children.length > 1 && (
          <Select
            items={children.map((c) => ({ value: c._id, label: c.name }))}
            value={selectedChildId}
            onValueChange={(v) => setSelectedChildId(v || "")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {children.length === 0 && !loading ? (
        <Card>
          <CardContent>
            <EmptyState icon={Users} message="No child linked to your account yet." />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Overall GPA", value: loading ? "…" : data?.overallGPA || "—", icon: Award },
              { title: "Class Rank", value: loading ? "…" : data?.rank || "—", icon: TrendingUp },
              { title: "Subjects", value: loading ? "…" : String(data?.subjectCount ?? 0), icon: BookOpen },
              { title: "Avg Score", value: loading ? "…" : data?.avgScore || "—", icon: BarChart3 },
            ].map((s) => (
              <Card key={s.title}>
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center shrink-0">
                    <s.icon className="h-5 w-5 text-[#4F46E5]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">{s.title}</p>
                    <p className="text-xl font-bold text-[#172554]">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-64 rounded-md" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-[280px] w-full rounded-lg" />
                <Skeleton className="h-[280px] w-full rounded-lg" />
              </div>
            </div>
          ) : !data?.hasResults ? (
            <Card>
              <CardContent>
                <EmptyState icon={TrendingUp} message="No exam results yet. Results will appear here once exams are graded." />
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="subjects">Subject-wise</TabsTrigger>
                <TabsTrigger value="remarks">Teacher Remarks</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#4F46E5]" /> Attendance Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {performanceTrend.length === 0 ? (
                        <div className="flex items-center justify-center h-[280px] text-[#64748B] text-sm">No attendance data available.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={performanceTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} />
                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                            <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} dot={{ fill: "#4F46E5", r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[#4F46E5]" /> Student vs Class Average
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {radarData.length === 0 ? (
                        <div className="flex items-center justify-center h-[280px] text-[#64748B] text-sm">No subject data available.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={280}>
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="#E2E8F0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 11 }} />
                            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                            <Radar name="Student" dataKey="student" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.3} />
                            <Radar name="Class Avg" dataKey="classAvg" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} />
                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="subjects">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Subject-wise Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subjectData.length === 0 ? (
                      <div className="flex items-center justify-center h-[300px] text-[#64748B] text-sm">No subject data available.</div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={subjectData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} />
                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
                            <Bar dataKey="score" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Score" />
                            <Bar dataKey="classAvg" fill="#8B5CF6" radius={[6, 6, 0, 0]} name="Class Average" />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          {subjectData.map((s) => (
                            <div key={s.subject} className="p-3 rounded-xl bg-[#F8FAFC] text-center">
                              <p className="text-xs text-[#64748B]">{s.subject}</p>
                              <p className="text-lg font-bold text-[#172554] mt-1">{s.score}%</p>
                              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#E2E8F0] text-[#334155] font-medium">{s.grade}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="remarks">
                {remarks.length === 0 ? (
                  <Card>
                    <CardContent>
                      <EmptyState icon={BookOpen} message="No teacher remarks yet." />
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {remarks.map((r, i) => (
                      <Card key={i}>
                        <CardContent className="p-5 flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${r.positive ? "bg-green-50" : "bg-amber-50"}`}>
                            <BookOpen className={`h-5 w-5 ${r.positive ? "text-green-600" : "text-amber-600"}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-[#172554]">{r.teacher}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155] font-medium">{r.subject}</span>
                            </div>
                            <p className="text-sm text-[#64748B]">{r.remark}</p>
                            <p className="text-xs text-[#64748B] mt-2">{r.date}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
