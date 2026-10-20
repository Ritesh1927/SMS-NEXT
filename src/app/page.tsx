import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";
import { HomeRedirect } from "@/components/marketing/HomeRedirect";

// Public homepage (server-rendered for SEO). Signed-in users and installed
// app launches are redirected before first paint by HOME_REDIRECT_SCRIPT
// in the root layout, and on client-side navigations by HomeRedirect.
export const metadata: Metadata = {
  title: "EduSync · Smart School ERP for Indian Schools",
  description:
    "EduSync is a complete school ERP to manage admissions, attendance, fees, exams, timetable, transport, HR and parent communication from one dashboard. Book a free demo.",
  openGraph: {
    title: "EduSync · Smart School ERP",
    description: "Simplify school management with smart digital solutions. Admissions, attendance, fees, exams and more in one platform.",
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <HomeRedirect />
      <LandingPage />
    </>
  );
}
