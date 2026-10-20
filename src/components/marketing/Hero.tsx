import Image from "next/image";
import { ArrowRight, Bell, CalendarCheck, Check, IndianRupee, Sparkles, TrendingUp, Users, UsersRound } from "lucide-react";
import heroImage from "@/assets/login-img.png";
import { cn } from "@/lib/utils";
import { TRUST_POINTS } from "./content";
import { BTN_PRIMARY } from "./styles";
import { GradientText } from "./ui";
import { WatchVideoButton } from "./WatchVideoButton";

// Hero: split layout. Above-the-fold content animates in with CSS (not
// scroll reveal) so it's never hidden while the page is first painting.
export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden pt-28 pb-20 sm:pt-32 lg:pt-36 lg:pb-28">
      {/* Background: soft blue wash, glow blobs, dotted grid */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_520px_at_85%_-10%,rgba(80,72,229,0.30),transparent_60%),radial-gradient(800px_420px_at_-10%_20%,rgba(141,97,245,0.20),transparent_60%),linear-gradient(180deg,#EFEFFD_0%,#F8F8FE_70%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(rgba(80,72,229,0.10)_1px,transparent_1px)] [mask-image:linear-gradient(180deg,black,transparent_85%)] [background-size:22px_22px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 xl:grid-cols-[1.05fr_1fr] xl:gap-10">
        {/* Copy */}
        <div className="animate-in duration-700 fill-mode-both fade-in-0 slide-in-from-bottom-4 md:mx-auto md:max-w-3xl md:text-center xl:mx-0 xl:max-w-none xl:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[13px] font-semibold text-primary shadow-sm ring-1 ring-primary/30 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[#F59E0B]" /> India&apos;s Smart School ERP
          </span>
          <h1 className="mt-6 font-heading text-[34px] leading-[1.08] min-[380px]:text-[40px] font-extrabold tracking-tight text-foreground sm:text-[54px] xl:text-[62px]">
            Simplify School Management with <GradientText>Smart Digital Solutions</GradientText>
          </h1>
          <p className="mt-6 max-w-xl text-[16px] sm:text-[17px] md:mx-auto xl:mx-0 leading-relaxed text-muted-foreground">
            A complete ERP platform for schools to manage admissions, academics, attendance, fees, transport, communication,
            examinations, HR, finance, and much more from one dashboard.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row md:justify-center xl:justify-start">
            <a href="#contact" className={BTN_PRIMARY}>
              Book Free Demo <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover/btn:translate-x-0.5" />
            </a>
            <WatchVideoButton />
          </div>
          <ul className="mt-9 grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap md:justify-center xl:justify-start" aria-label="Highlights">
            {TRUST_POINTS.map((t) => (
              <li key={t} className="flex items-center gap-2 text-[14.5px] font-medium text-foreground/80">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual */}
        <div className="relative mx-auto w-full max-w-[600px] animate-in md:max-w-[640px] delay-150 duration-1000 fill-mode-both fade-in-0 zoom-in-95">
          <div className="ms-glow absolute inset-[8%] rounded-full bg-[radial-gradient(circle,var(--accent)_0%,var(--primary)_45%,transparent_72%)] opacity-35 blur-2xl" aria-hidden />
          <div className="absolute inset-[10%] rounded-full bg-gradient-to-br from-[#E6E4FD] to-[#D5D0FB] ring-1 ring-white/70" aria-hidden />
          <Image
            src={heroImage}
            alt="Students reading on a stack of books"
            priority
            sizes="(min-width: 1024px) 600px, 92vw"
            className="relative z-10 h-auto w-full drop-shadow-[0_30px_40px_rgba(80,72,229,0.25)]"
          />

          {/* Floating analytics cards */}
          <FloatCard className="ms-float top-[2%] left-[-2%] max-sm:origin-top-left max-sm:scale-[0.8] sm:left-[-3%]" icon={Users} tone="from-primary to-accent" label="Total Students" value="1,248" delta="+12% this month" />
          <FloatCard className="ms-float-alt right-[-2%] max-sm:top-auto max-sm:bottom-[2%] max-sm:origin-bottom-right max-sm:scale-[0.8] sm:top-[6%] sm:right-[-3%]" icon={CalendarCheck} tone="from-[#16A34A] to-[#4ADE80]" label="Student Attendance" value="96.4%" delta="+2.1% this week" />
          <FloatCard className="ms-float-slow top-[40%] left-[-3%] hidden sm:flex" icon={IndianRupee} tone="from-[#F59E0B] to-warning" label="Fees Collected" value="₹8,45,000" delta="+19% this month" />
          <FloatCard className="ms-float top-[44%] right-[-3%] hidden sm:flex" icon={UsersRound} tone="from-[#7C3AED] to-[#A78BFA]" label="Parent Connections" value="1,120" delta="+30% this term" />

          {/* Live notification */}
          <div className="ms-float-alt absolute bottom-[-6%] left-[-3%] z-20 hidden w-[230px] items-start gap-3 rounded-2xl bg-white/90 p-3 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.35)] ring-1 ring-white backdrop-blur-xl sm:flex">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#E11D48] to-[#FB7185] text-white">
              <Bell className="h-4 w-4" />
              <span className="ms-ping absolute inset-0 rounded-xl bg-[#FB7185]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live notification
              </span>
              <span className="block text-[12.5px] leading-snug font-semibold text-foreground">Fee paid by Aarav&apos;s parent</span>
              <span className="block text-[11px] text-muted-foreground">₹12,500 · just now</span>
            </span>
          </div>

          {/* Academic performance */}
          <div className="ms-float-slow absolute right-[0%] bottom-[2%] z-20 hidden w-[210px] sm:block rounded-2xl bg-white/90 p-3.5 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.35)] ring-1 ring-white backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-foreground/80">Academic Performance</span>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-success"><TrendingUp className="h-3 w-3" /> 28%</span>
            </div>
            <div className="mt-3 flex h-14 items-end gap-1.5" aria-hidden>
              {[45, 60, 52, 70, 64, 82, 94].map((h, i) => (
                <span
                  key={i}
                  className="ms-bar flex-1 rounded-t-md bg-gradient-to-t from-primary to-accent"
                  style={{ height: `${h}%`, animationDelay: `${400 + i * 90}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Curved separator */}
      <svg className="absolute inset-x-0 -bottom-px h-14 w-full text-white sm:h-20" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
        <path fill="currentColor" d="M0 80V40C240 8 480 0 720 16s480 56 720 40v24H0Z" />
      </svg>
    </section>
  );
}

function FloatCard({
  className, icon: Icon, tone, label, value, delta,
}: {
  className?: string;
  icon: typeof Users;
  tone: string;
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className={cn("absolute z-20 flex items-center gap-3 rounded-2xl bg-white/90 py-3 pr-4 pl-3 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.35)] ring-1 ring-white backdrop-blur-xl", className)}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="block font-heading text-[17px] leading-tight font-extrabold text-foreground">{value}</span>
        <span className="block text-[10.5px] font-semibold text-success">{delta}</span>
      </span>
    </div>
  );
}
