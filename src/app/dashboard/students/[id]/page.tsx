"use client";

import { use } from "react";
import { StudentDetail } from "@/components/dashboard/StudentDetail";

export default function ViewStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StudentDetail studentId={id} />;
}
