import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans, DM_Sans, Lora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

// Same two Google Fonts as the original SMS-FRONTEND (Plus Jakarta Sans for
// headings, DM Sans for body text) so sms-next's typography matches it.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Elegant serif for the dashboard hero's rotating quote -- gives it a
// distinct "pull-quote" character instead of reading as more body text.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "EduNivo",
  description: "School Management System",
};

// viewportFit: "cover" lets the mobile dashboard chrome (sticky top bar,
// fixed bottom nav) paint under the iOS notch/home-indicator safe areas
// and use env(safe-area-inset-*) padding to stay clear of them, instead of
// leaving a plain white bar there. No visible effect on desktop or on
// devices without a safe-area inset.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${plusJakartaSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla)
          inject attributes like cz-shortcut-listen onto <body> before React
          hydrates. That's a real DOM mismatch but not a bug in our markup --
          without this, React logs a scary (and misleading) hydration error
          for an attribute we never rendered and don't control. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
