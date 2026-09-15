// Mirrors SMS-BACKEND's permissions.controller.js ALL_KEYS/ALL_PAGES exactly,
// so a Permission doc created by that app's logic (or this one) means the
// same thing either way.

export const ALL_PERMISSION_KEYS = [
  "canCreateStudent", "canEditStudent", "canDeleteStudent", "canViewAllStudents",
  "canMarkAttendance", "canViewAttendance",
  "canManageFees", "canViewFees",
  "canCreateExam", "canEnterMarks", "canViewExams",
  "canPostNotice", "canViewNotices",
  "canAssignHomework", "canViewHomework",
  "canPostNoticeBoard", "canManageLibrary",
  "canDailyChallenge", "canAwardBadges",
] as const;

export const ALL_PAGE_KEYS = [
  "pageStudents", "pageTeachers", "pageClasses", "pageAttendance",
  "pageFees", "pageHomework", "pageTimetable", "pageNotices",
  "pageCommunication", "pageReports", "pageAi", "pageRolesPermissions",
  "pageUserMaster", "pageSubjectClass", "pageTestsExams",
  "pageStudyMaterials", "pageSettings",
] as const;

export const PERMISSION_GROUPS: { label: string; keys: { key: string; label: string }[] }[] = [
  {
    label: "Students",
    keys: [
      { key: "canViewAllStudents", label: "View All Students" },
      { key: "canCreateStudent", label: "Create Student" },
      { key: "canEditStudent", label: "Edit Student" },
      { key: "canDeleteStudent", label: "Delete Student" },
    ],
  },
  {
    label: "Attendance",
    keys: [
      { key: "canViewAttendance", label: "View Attendance" },
      { key: "canMarkAttendance", label: "Mark Attendance" },
    ],
  },
  {
    label: "Exams & Results",
    keys: [
      { key: "canViewExams", label: "View Exams" },
      { key: "canCreateExam", label: "Create Exam" },
      { key: "canEnterMarks", label: "Enter Marks" },
    ],
  },
  {
    label: "Homework",
    keys: [
      { key: "canViewHomework", label: "View Homework" },
      { key: "canAssignHomework", label: "Assign Homework" },
    ],
  },
  {
    label: "Notice Board",
    keys: [
      { key: "canViewNotices", label: "View Notices" },
      { key: "canPostNotice", label: "Post Notice" },
      { key: "canPostNoticeBoard", label: "Post on Notice Board" },
    ],
  },
  {
    label: "Fees",
    keys: [
      { key: "canViewFees", label: "View Fees" },
      { key: "canManageFees", label: "Manage Fees" },
    ],
  },
  {
    label: "Other",
    keys: [
      { key: "canManageLibrary", label: "Manage Library" },
      { key: "canDailyChallenge", label: "Daily Challenge" },
      { key: "canAwardBadges", label: "Award Badges" },
    ],
  },
];

export const PAGE_GROUPS: { label: string; keys: { key: string; label: string }[] }[] = [
  {
    label: "Core",
    keys: [
      { key: "pageStudents", label: "Students" },
      { key: "pageTeachers", label: "Teachers" },
      { key: "pageClasses", label: "Classes" },
      { key: "pageAttendance", label: "Attendance" },
    ],
  },
  {
    label: "Academics",
    keys: [
      { key: "pageHomework", label: "Homework" },
      { key: "pageTestsExams", label: "Tests & Exams" },
      { key: "pageTimetable", label: "Timetable" },
      { key: "pageSubjectClass", label: "Subject & Class" },
    ],
  },
  {
    label: "Finance & Communication",
    keys: [
      { key: "pageFees", label: "Fees" },
      { key: "pageNotices", label: "Notice Board" },
      { key: "pageCommunication", label: "Communication" },
    ],
  },
  {
    label: "Tools & Settings",
    keys: [
      { key: "pageReports", label: "Reports" },
      { key: "pageAi", label: "AI Assistant" },
      { key: "pageStudyMaterials", label: "Study Materials" },
      { key: "pageRolesPermissions", label: "Roles & Permissions" },
      { key: "pageUserMaster", label: "User Master" },
      { key: "pageSettings", label: "Settings" },
    ],
  },
];

// Builds the boolean map stored on Teacher.permissions from the flat key
// array a Permission doc holds, so the existing permission-gated routes
// (requireFeeManager, exam creation, etc.) keep working unchanged.
export function permissionArrayToBooleanMap(keys: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const k of ALL_PERMISSION_KEYS) map[k] = keys.includes(k);
  return map;
}
