import { Apple, Bell, Check, ChevronRight, IndianRupee, Play, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { APPS, STEPS } from "./content";
import { CARD } from "./styles";
import { GradientIcon, GradientText, SectionHeading } from "./ui";
import { Reveal } from "./motion";

/** Four-step onboarding timeline (horizontal on desktop, vertical on phones). */
export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-20 bg-[linear-gradient(180deg,#F8F8FE,#EFEFFD)] py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Get started in 4 simple steps"
          title={<>Live in Days, <GradientText>Not Months</GradientText></>}
          description="Our team handles setup, data import and training, so your school starts using EduNivo with confidence."
        />
        <ol className="relative mx-auto mt-14 grid max-w-md gap-10 sm:mt-16 lg:max-w-none lg:grid-cols-4 lg:gap-6">
          {/* Connector line (desktop) */}
          <div className="pointer-events-none absolute top-8 right-[12.5%] left-[12.5%] hidden h-0.5 lg:block" aria-hidden>
            <div className="h-full w-full rounded-full bg-primary/20" />
            <div className="ms-draw absolute inset-0 rounded-full bg-gradient-to-r from-primary via-accent to-coral" />
          </div>
          {/* Connector line (mobile) */}
          <div className="pointer-events-none absolute top-8 bottom-8 left-8 w-0.5 bg-gradient-to-b from-primary via-accent to-coral lg:hidden" aria-hidden />

          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 120} className="relative flex gap-5 lg:flex-col lg:items-center lg:text-center">
              <div className="relative z-10 shrink-0">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_14px_30px_-12px_rgba(80,72,229,0.5)] ring-1 ring-primary/30">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
                    <s.icon className="h-5.5 w-5.5" />
                  </span>
                </span>
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-coral font-heading text-[12px] font-extrabold text-white ring-2 ring-white">
                  {i + 1}
                </span>
              </div>
              <div className="pt-1 lg:mt-6 lg:pt-0">
                <h3 className="font-heading text-[18px] font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 max-w-xs text-[14.5px] leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Teacher / Parent / Student apps with phone mockups. */
export function MobileApps() {
  return (
    <section id="apps" className="relative scroll-mt-20 overflow-hidden bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-2 lg:px-8">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Mobile apps"
            title={<>Your School, in <GradientText>Every Pocket</GradientText></>}
            description="Dedicated apps for teachers, parents and students on Android and iPhone, so everyone stays connected, wherever they are."
          />
          <div className="mt-10 space-y-4">
            {APPS.map((app, i) => (
              <Reveal key={app.title} delay={i * 100}>
                <article className={cn(CARD, "group flex flex-col gap-3 p-5 transition-all min-[400px]:flex-row min-[400px]:gap-4 duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-24px_rgba(80,72,229,0.45)]")}>
                  <GradientIcon tone={app.tone}>
                    <app.icon className="h-5.5 w-5.5" />
                  </GradientIcon>
                  <div className="min-w-0">
                    <h3 className="font-heading text-[17px] font-bold text-foreground">{app.title}</h3>
                    <p className="mt-1 text-[14px] text-muted-foreground">{app.text}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {app.points.map((p) => (
                        <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-[#F8F8FE] px-3 py-1 text-[12.5px] font-medium whitespace-nowrap text-foreground/80 ring-1 ring-primary/20">
                          <Check className="h-3 w-3 text-success" strokeWidth={3} /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal delay={300} className="mt-8 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2.5 rounded-xl bg-foreground px-4 py-2.5 text-white">
              <Play className="h-5 w-5 fill-current" />
              <span className="leading-tight"><span className="block text-[10px] text-white/70">Available on</span><span className="block text-[14px] font-semibold">Android</span></span>
            </span>
            <span className="inline-flex items-center gap-2.5 rounded-xl bg-foreground px-4 py-2.5 text-white">
              <Apple className="h-5 w-5 fill-current" />
              <span className="leading-tight"><span className="block text-[10px] text-white/70">Available on</span><span className="block text-[14px] font-semibold">iPhone</span></span>
            </span>
          </Reveal>
        </div>

        {/* Phones */}
        <Reveal className="relative mx-auto flex h-[440px] w-full max-w-[520px] items-center justify-center sm:h-[560px]">
          <div className="ms-glow absolute inset-10 rounded-full bg-[radial-gradient(circle,rgba(141,97,245,0.55),transparent_70%)] blur-2xl" aria-hidden />
          <div className="ms-float-alt absolute top-6 left-2 z-10 -rotate-6 max-sm:origin-top-left max-sm:scale-[0.8] sm:left-6">
            <AndroidPhone />
          </div>
          <div className="ms-float absolute top-0 right-2 z-20 rotate-3 max-sm:origin-top-right max-sm:scale-[0.8] sm:right-4">
            <IPhone />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Parent app on an iPhone-style frame. */
function IPhone() {
  return (
    <div className="w-[230px] rounded-[42px] bg-[#0F172A] p-2.5 shadow-[0_40px_70px_-28px_rgba(16,24,40,0.6)] ring-1 ring-black/40" role="img" aria-label="Parent app on iPhone">
      <div className="relative h-[470px] overflow-hidden rounded-[34px] bg-[#F8F8FE]">
        <div className="absolute top-2 left-1/2 z-10 h-6 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="bg-gradient-to-br from-primary to-accent px-4 pt-11 pb-5 text-white">
          <p className="text-[10px] text-white/75">Good morning</p>
          <p className="font-heading text-[15px] font-bold">Mrs. Sharma</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/15 p-2 ring-1 ring-white/25">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-[11px] font-bold text-primary">AS</span>
            <span><span className="block text-[11px] font-semibold">Aarav Sharma</span><span className="block text-[9px] text-white/75">Class 5-B · Roll 12</span></span>
          </div>
        </div>
        <div className="-mt-3 space-y-2.5 px-3">
          <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-foreground/80">Term 2 fee</span>
              <span className="rounded-full bg-warning/30 px-1.5 text-[8.5px] font-bold text-[#B45309]">Due in 5 days</span>
            </div>
            <p className="mt-1 flex items-center font-heading text-[17px] font-extrabold text-foreground"><IndianRupee className="h-3.5 w-3.5" />12,500</p>
            <span className="mt-1.5 flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-primary to-accent py-1.5 text-[10px] font-semibold text-white">Pay now</span>
          </div>
          <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/5">
            <p className="text-[10px] font-semibold text-foreground/80">Attendance · October</p>
            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {Array.from({ length: 21 }).map((_, i) => (
                <span key={i} className={cn("h-3.5 rounded", i === 9 ? "bg-[#FB7185]" : i % 7 === 6 ? "bg-[#E4E7EC]" : "bg-[#4ADE80]")} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#A78BFA]/20 text-[#6D28D9]"><Bell className="h-3.5 w-3.5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-foreground">Annual Day on 15 Nov</span><span className="block text-[8.5px] text-muted-foreground">School notice · 1h ago</span></span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Teacher app on an Android-style frame. */
function AndroidPhone() {
  const students = [
    { name: "Aarav Sharma", present: true },
    { name: "Diya Patel", present: true },
    { name: "Kabir Singh", present: false },
    { name: "Meera Iyer", present: true },
    { name: "Rohan Das", present: true },
    { name: "Sara Khan", present: true },
  ];
  return (
    <div className="w-[220px] rounded-[30px] bg-[#1E293B] p-2 shadow-[0_40px_70px_-28px_rgba(16,24,40,0.6)] ring-1 ring-black/40" role="img" aria-label="Teacher app on Android">
      <div className="relative h-[450px] overflow-hidden rounded-[24px] bg-white">
        <div className="absolute top-2.5 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-black" />
        <div className="bg-gradient-to-br from-[#16A34A] to-[#4ADE80] px-4 pt-8 pb-4 text-white">
          <p className="text-[10px] text-white/80">Mark attendance</p>
          <p className="font-heading text-[15px] font-bold">Class 5-B · Maths</p>
          <p className="mt-1 text-[9.5px] text-white/85">5 of 6 present</p>
        </div>
        <ul className="divide-y divide-black/5 px-3">
          {students.map((s) => (
            <li key={s.name} className="flex items-center gap-2 py-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">{s.name.split(" ").map((w) => w[0]).join("")}</span>
              <span className="flex-1 text-[10.5px] font-medium text-foreground">{s.name}</span>
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", s.present ? "bg-success text-white" : "bg-[#FB7185] text-white")}>
                {s.present ? <Check className="h-3 w-3" strokeWidth={3} /> : <XIcon className="h-3 w-3" strokeWidth={3} />}
              </span>
            </li>
          ))}
        </ul>
        <div className="absolute inset-x-3 bottom-3 rounded-xl bg-gradient-to-r from-[#16A34A] to-success py-2 text-center text-[10.5px] font-semibold text-white">Submit attendance</div>
      </div>
    </div>
  );
}
