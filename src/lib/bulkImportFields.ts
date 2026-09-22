import { normalizedKeys, type TemplateColumn } from "@/lib/excelImport";

// Single source of truth for each bulk-import sheet's column labels, so the
// template-download route and the upload-parsing route can't drift apart —
// both derive their column keys from the same normalizeHeader() pass over
// these exact label strings.
export const STUDENT_LABELS = {
  name: "Student Name*",
  studentClass: "Class*",
  section: "Section",
  dateOfBirth: "Date of Birth* (YYYY-MM-DD)",
  gender: "Gender (male/female/other)",
  phone: "Student Phone",
  parentName: "Father Name*",
  parentPhone: "Father Phone*",
  parentEmail: "Father Email*",
  motherName: "Mother Name*",
  motherPhone: "Mother Phone",
  admissionDate: "Admission Date* (YYYY-MM-DD)",
  address: "Address",
  bloodGroup: "Blood Group",
} as const;

export const STUDENT_KEYS = normalizedKeys(STUDENT_LABELS);

export const STUDENT_TEMPLATE_COLUMNS: TemplateColumn[] = Object.entries(STUDENT_LABELS).map(([field, label]) => ({
  key: STUDENT_KEYS[field as keyof typeof STUDENT_LABELS],
  label,
  width: label.length > 24 ? 30 : 20,
}));

export const STUDENT_SAMPLE_ROW: Record<string, string> = {
  [STUDENT_KEYS.name]: "Aarav Sharma",
  [STUDENT_KEYS.studentClass]: "7",
  [STUDENT_KEYS.section]: "A",
  [STUDENT_KEYS.dateOfBirth]: "2015-06-12",
  [STUDENT_KEYS.gender]: "male",
  [STUDENT_KEYS.phone]: "9876500001",
  [STUDENT_KEYS.parentName]: "Rajesh Sharma",
  [STUDENT_KEYS.parentPhone]: "9876500002",
  [STUDENT_KEYS.parentEmail]: "rajesh.sharma@example.com",
  [STUDENT_KEYS.motherName]: "Sunita Sharma",
  [STUDENT_KEYS.motherPhone]: "9876500003",
  [STUDENT_KEYS.admissionDate]: "2024-04-01",
  [STUDENT_KEYS.address]: "12 MG Road, Pune",
  [STUDENT_KEYS.bloodGroup]: "B+",
};

export const TEACHER_LABELS = {
  name: "Name*",
  email: "Email*",
  staffType: "Staff Type (teaching/non-teaching)",
  primarySubject: "Primary Subject* (required if teaching)",
  secondarySubject: "Secondary Subject",
  subjects: "Other Subjects (comma-separated)",
  phone: "Phone",
  designation: "Designation",
  department: "Department (for non-teaching)",
  qualification: "Qualification",
  experience: "Experience",
  gender: "Gender (male/female/other)",
  dateOfBirth: "Date of Birth (YYYY-MM-DD)",
  joiningDate: "Joining Date (YYYY-MM-DD)",
  address: "Address",
  bloodGroup: "Blood Group",
  employmentType: "Employment Type (full-time/part-time/contract)",
} as const;

export const TEACHER_KEYS = normalizedKeys(TEACHER_LABELS);

export const TEACHER_TEMPLATE_COLUMNS: TemplateColumn[] = Object.entries(TEACHER_LABELS).map(([field, label]) => ({
  key: TEACHER_KEYS[field as keyof typeof TEACHER_LABELS],
  label,
  width: label.length > 24 ? 32 : 20,
}));

export const TEACHER_SAMPLE_ROW: Record<string, string> = {
  [TEACHER_KEYS.name]: "Anita Verma",
  [TEACHER_KEYS.email]: "anita.verma@example.com",
  [TEACHER_KEYS.staffType]: "teaching",
  [TEACHER_KEYS.primarySubject]: "Mathematics",
  [TEACHER_KEYS.secondarySubject]: "Science",
  [TEACHER_KEYS.subjects]: "",
  [TEACHER_KEYS.phone]: "9876500004",
  [TEACHER_KEYS.designation]: "Teacher",
  [TEACHER_KEYS.department]: "",
  [TEACHER_KEYS.qualification]: "M.Sc Mathematics",
  [TEACHER_KEYS.experience]: "5 years",
  [TEACHER_KEYS.gender]: "female",
  [TEACHER_KEYS.dateOfBirth]: "1990-03-15",
  [TEACHER_KEYS.joiningDate]: "2024-06-01",
  [TEACHER_KEYS.address]: "",
  [TEACHER_KEYS.bloodGroup]: "",
  [TEACHER_KEYS.employmentType]: "full-time",
};
