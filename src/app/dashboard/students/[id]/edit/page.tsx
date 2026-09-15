"use client";

import { use } from "react";
import { StudentForm } from "@/components/dashboard/StudentForm";

export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StudentForm studentId={id} />;
}
