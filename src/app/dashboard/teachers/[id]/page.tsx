"use client";

import { use } from "react";
import { TeacherDetail } from "@/components/dashboard/TeacherDetail";

export default function ViewTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TeacherDetail teacherId={id} />;
}
