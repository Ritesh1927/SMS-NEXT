import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BENEFITS, MODULES, STATS } from "./content";
import { CARD, TONES } from "./styles";
import { GradientIcon, GradientText, SectionHeading } from "./ui";
import { CountUp, Reveal } from "./motion";

/** Four statistic cards with animated counters (SAMPLE numbers -- see content.ts). */
export function StatsBand() {
  return (
    <section aria-label="EduNivo in numbers" className="relative bg-white pb-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 lg:grid-cols-4 lg:gap-6 lg:px-8">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 90} className={cn(CARD, "group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-1 min-[400px]:p-5 sm:p-6")}>
            <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-accent/20 blur-2xl transition-opacity group-hover:opacity-100" aria-hidden />
            <div className="relative flex flex-col items-start gap-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-4">
              <GradientIcon tone={i === 2 ? "amber" : i === 3 ? "green" : i === 1 ? "violet" : "blue"}>
                <s.icon className="h-5.5 w-5.5" />
              </GradientIcon>
              <div className="min-w-0">
                <p className="font-heading text-[28px] whitespace-nowrap leading-none font-extrabold tracking-tight text-foreground sm:text-[34px]">
                  <CountUp to={s.value} />
                  <span className="text-primary">{s.suffix}</span>
                </p>
                <p className="mt-1.5 text-[13.5px] font-medium text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** "Everything your school needs": the 16-module grid. */
export function ModulesGrid() {
  return (
    <section id="modules" className="relative scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Complete ERP ecosystem"
          title={<>Everything Your School Needs in <GradientText>One Platform</GradientText></>}
          description="From the first admission enquiry to the final report card, EduNivo connects administrators, teachers, parents and students in one secure, easy-to-use system. Every module shares the same data, so nothing is entered twice."
        />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {MODULES.map((m, i) => (
            <Reveal as="li" key={m.title} delay={(i % 4) * 70}>
              <article
                className={cn(
                  CARD,
                  "group relative h-full overflow-hidden bg-gradient-to-br to-white p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-26px_rgba(80,72,229,0.45)] hover:ring-primary/40 max-sm:rounded-2xl max-sm:p-4",
                  TONES[m.tone].soft,
                )}
              >
                <div className="flex items-start justify-between">
                  <GradientIcon tone={m.tone}>
                    <m.icon className="h-5.5 w-5.5" />
                  </GradientIcon>
                  <ArrowUpRight className="h-5 w-5 -translate-x-1 translate-y-1 text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden />
                </div>
                <h3 className="mt-3.5 font-heading text-[14.5px] leading-snug font-bold text-foreground sm:mt-5 sm:text-[17px]">{m.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground sm:mt-2 sm:text-[14px]">{m.text}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Why EduNivo: six benefit cards on a soft blue band with curved edges. */
export function WhyUs() {
  return (
    <section id="why" className="relative scroll-mt-20 bg-[linear-gradient(180deg,#EFEFFD,#F8F8FE)] py-24 sm:py-32">
      <svg className="absolute inset-x-0 -top-px h-12 w-full rotate-180 text-white sm:h-16" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden>
        <path fill="currentColor" d="M0 64V32C320 0 640 0 960 24s320 32 480 24v16H0Z" />
      </svg>
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Your school's growth partner"
          title={<>Why Schools Choose <GradientText>EduNivo</GradientText></>}
          description="Designed to make school management simpler, smarter and more efficient, for every person on campus."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 3) * 90}>
              <article className={cn(CARD, "group relative h-full overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-26px_rgba(80,72,229,0.45)]")}>
                <div className={cn("pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-transform duration-500 group-hover:scale-125", TONES[b.tone].soft)} aria-hidden />
                <GradientIcon tone={b.tone} size="lg">
                  <b.icon className="h-6 w-6" />
                </GradientIcon>
                <h3 className="mt-6 font-heading text-[19px] font-bold text-foreground">{b.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted-foreground">{b.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
      <svg className="absolute inset-x-0 -bottom-px h-12 w-full text-white sm:h-16" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden>
        <path fill="currentColor" d="M0 64V32C320 0 640 0 960 24s320 32 480 24v16H0Z" />
      </svg>
    </section>
  );
}
