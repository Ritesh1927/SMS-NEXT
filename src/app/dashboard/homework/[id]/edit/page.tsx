"use client";

import { use } from "react";
import { HomeworkForm } from "@/components/dashboard/HomeworkForm";

export default function EditHomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <HomeworkForm homeworkId={id} />;
}
