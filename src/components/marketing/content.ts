import {
  Award, BarChart3, BedDouble, Bell, BookOpen, Bus, CalendarCheck, CalendarDays, ClipboardList, Cloud, FileCheck2, GraduationCap,
  Headphones, IndianRupee, Layers, Leaf, Library, LockKeyhole, MessagesSquare, NotebookPen, Rocket, Settings2,
  Smartphone, Timer, UserCheck, UserPlus, Users, Wallet, type LucideIcon,
} from "lucide-react";

// All homepage copy in one place. Components only lay it out.
//
// ⚠️ SAMPLE CONTENT: the statistics, testimonials and partner-school
// names below are placeholders from the design brief. Replace them with
// real, verifiable figures, quotes (with permission) and logos before
// this page goes live.

export const BRAND = {
  name: "EduSync",
  tagline: "School ERP",
  email: "hello@edusync.in",
  phone: "+91 98765 43210",
  address: "Bengaluru, Karnataka, India",
  /** Product demo video (YouTube embed URL). Empty = "Watch Video" opens the live dashboard tour instead. */
  demoVideoUrl: "",
};

export const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#modules", label: "Modules" },
  { href: "#why", label: "Why EduSync" },
  { href: "#pricing", label: "Pricing" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "#contact", label: "Contact" },
];

export const TRUST_POINTS = ["Secure", "Cloud Based", "Mobile Friendly", "24×7 Support"];

/** SAMPLE CONTENT -- replace with real numbers. */
export const STATS = [
  { value: 500, suffix: "+", label: "Schools", icon: GraduationCap },
  { value: 1, suffix: "L+", label: "Students", icon: Users },
  { value: 98, suffix: "%", label: "Customer Satisfaction", icon: Award },
  { value: 24, suffix: "/7", label: "Support", icon: Headphones },
];

export type Tone = "blue" | "sky" | "amber" | "green" | "violet" | "rose" | "teal" | "indigo";

export const MODULES: { title: string; text: string; icon: LucideIcon; tone: Tone }[] = [
  { title: "Student Information", text: "One complete profile for every student, from admission to alumni.", icon: Users, tone: "blue" },
  { title: "Admission Management", text: "Online enquiries, applications and enrolment in a few clicks.", icon: UserPlus, tone: "violet" },
  { title: "Attendance", text: "Daily and period-wise attendance with instant parent alerts.", icon: CalendarCheck, tone: "green" },
  { title: "Fees & Payment", text: "Fee structures, online payments, receipts and reminders.", icon: IndianRupee, tone: "amber" },
  { title: "Examination", text: "Exams, marks entry, grading and printable report cards.", icon: FileCheck2, tone: "rose" },
  { title: "Timetable", text: "Clash-free class and teacher timetables, built in minutes.", icon: CalendarDays, tone: "sky" },
  { title: "Homework", text: "Assign, collect and grade homework with attachments.", icon: NotebookPen, tone: "indigo" },
  { title: "Transport", text: "Routes, stops, vehicles and transport fees in one place.", icon: Bus, tone: "amber" },
  { title: "Library", text: "Catalogue, issue and return books with due-date tracking.", icon: Library, tone: "teal" },
  { title: "Hostel", text: "Rooms, allocations and hostel fees for residential schools.", icon: BedDouble, tone: "violet" },
  { title: "HR & Payroll", text: "Staff records, leave and salary processing, simplified.", icon: Wallet, tone: "green" },
  { title: "Teacher Portal", text: "Classes, attendance, marks and homework from one screen.", icon: ClipboardList, tone: "blue" },
  { title: "Parent App", text: "Fees, attendance, results and notices on every parent's phone.", icon: Smartphone, tone: "rose" },
  { title: "Student App", text: "Timetable, homework and study material for every student.", icon: BookOpen, tone: "sky" },
  { title: "Communication", text: "Notices, chat and alerts that reach the right people.", icon: MessagesSquare, tone: "indigo" },
  { title: "Reports & Analytics", text: "Live dashboards and exportable reports for decision makers.", icon: BarChart3, tone: "teal" },
];

export const BENEFITS: { title: string; text: string; icon: LucideIcon; tone: Tone }[] = [
  { title: "Save Time", text: "Automate attendance, fees and reports so staff focus on students, not spreadsheets.", icon: Timer, tone: "blue" },
  { title: "Paperless Administration", text: "Digital records, receipts and report cards. No more registers and files.", icon: Leaf, tone: "green" },
  { title: "Increase Transparency", text: "Every fee, mark and notice is visible to the people who need it, in real time.", icon: Layers, tone: "violet" },
  { title: "Improve Parent Engagement", text: "Instant updates and two-way chat keep parents involved every day.", icon: Bell, tone: "amber" },
  { title: "Data Security", text: "Encrypted data, role-based access and secure cloud backups.", icon: LockKeyhole, tone: "rose" },
  { title: "Scalable Cloud Platform", text: "From a single school to a group of campuses, without new servers.", icon: Cloud, tone: "sky" },
];

export const SHOWCASE_POINTS = [
  "Real-time Analytics",
  "Student Tracking",
  "Fee Reports",
  "Attendance",
  "Performance Reports",
  "Communication",
  "Mobile Access",
];

export const STEPS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Book Demo", text: "Tell us about your school and see EduSync live.", icon: CalendarCheck },
  { title: "System Setup", text: "We configure classes, fees and roles, and import your data.", icon: Settings2 },
  { title: "Training & Onboarding", text: "Hands-on training for admins, teachers and staff.", icon: UserCheck },
  { title: "Go Live", text: "Launch with confidence, backed by dedicated support.", icon: Rocket },
];

export const APPS: { title: string; text: string; points: string[]; icon: LucideIcon; tone: Tone }[] = [
  { title: "Teacher App", text: "Mark attendance, enter marks and assign homework on the go.", points: ["One-tap attendance", "Marks & homework", "Class chat"], icon: ClipboardList, tone: "blue" },
  { title: "Parent App", text: "Everything about their child, in their pocket.", points: ["Fee payments", "Live attendance alerts", "Results & notices"], icon: Users, tone: "amber" },
  { title: "Student App", text: "Stay on top of classes, homework and exams.", points: ["Timetable & homework", "Study material", "Exam schedule"], icon: GraduationCap, tone: "green" },
];

/** SAMPLE CONTENT -- replace with real, approved testimonials. */
export const TESTIMONIALS = [
  { name: "Priya Sharma", role: "Principal", school: "Sunrise Public School, Pune", quote: "EduSync replaced four different tools for us. Fee collection, attendance and report cards now take a fraction of the time." },
  { name: "Rahul Mehta", role: "Director", school: "Bright Future Academy, Ahmedabad", quote: "The onboarding team set everything up in a week. Our teachers were comfortable with it from day one." },
  { name: "Anjali Verma", role: "Administrator", school: "Greenfield International, Jaipur", quote: "Parents love the app. Fee reminders and attendance alerts have cut our phone calls dramatically." },
  { name: "Suresh Nair", role: "Principal", school: "St. Joseph's School, Kochi", quote: "The dashboards give me a live view of the whole school. I finally make decisions with real data." },
  { name: "Kavita Rao", role: "Vice Principal", school: "Vidya Niketan, Hyderabad", quote: "Exams and report cards used to take weeks. Now results are published the same day marks are entered." },
];

/** SAMPLE CONTENT -- replace with partner schools' real logos (with permission). */
export const PARTNER_SCHOOLS = [
  "Sunrise Public School",
  "Greenfield International",
  "Bright Future Academy",
  "St. Joseph's School",
  "Vidya Niketan",
  "Delhi Heritage School",
  "Little Scholars",
  "Modern Era Academy",
];

export const FAQS = [
  { q: "Is data secure?", a: "Yes. All data is encrypted in transit and at rest, access is role-based (admins, teachers, parents and students each see only what they should), and backups run automatically on secure cloud infrastructure." },
  { q: "Can existing school data be imported?", a: "Absolutely. Our team imports students, staff, classes and fee data from your spreadsheets or previous software during setup, at no extra cost." },
  { q: "Does it work on mobile?", a: "EduSync works in any browser on phones, tablets and computers, and can be installed as an app on Android and iPhone for one-tap access." },
  { q: "Is training included?", a: "Yes. Every plan includes onboarding and hands-on training for administrators, teachers and office staff, plus recorded guides for new joiners." },
  { q: "What support is available?", a: "Our support team is available 24×7 by phone, email and chat, and every school gets a dedicated success manager during onboarding." },
  { q: "Is it suitable for small and large schools?", a: "Yes. EduSync scales from a single school with a few hundred students to multi-campus groups with thousands, and you only pay for what you use." },
];

export const FOOTER_COLUMNS = [
  { title: "Company", links: [{ label: "About Us", href: "#why" }, { label: "Why EduSync", href: "#why" }, { label: "Testimonials", href: "#testimonials" }, { label: "Contact", href: "#contact" }] },
  { title: "Modules", links: [{ label: "Admissions", href: "#modules" }, { label: "Attendance", href: "#modules" }, { label: "Fees & Payment", href: "#modules" }, { label: "Examination", href: "#modules" }, { label: "Parent App", href: "#apps" }] },
  { title: "Resources", links: [{ label: "Product Tour", href: "#features" }, { label: "How It Works", href: "#how" }, { label: "FAQs", href: "#faq" }, { label: "Mobile Apps", href: "#apps" }] },
  { title: "Support", links: [{ label: "Book a Demo", href: "#contact" }, { label: "Login", href: "/login" }, { label: "Help Center", href: "#faq" }] },
];

