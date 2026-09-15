"use client";

import { use } from "react";
import { TeacherForm } from "@/components/dashboard/TeacherForm";

export default function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TeacherForm teacherId={id} />;
}
