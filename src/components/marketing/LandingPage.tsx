import "./marketing.css";
import { SiteHeader } from "./SiteHeader";
import { Hero } from "./Hero";
import { ModulesGrid, StatsBand, WhyUs } from "./Sections";
import { DashboardShowcase } from "./Showcase";
import { HowItWorks, MobileApps } from "./StepsAndApps";
import { Faq, Testimonials, TrustedBy } from "./SocialProof";
import { DemoCta, SiteFooter } from "./CtaAndFooter";

/** EduSync public homepage. Section order follows the design brief. */
export function LandingPage() {
  return (
    <div className="ms-landing min-h-screen bg-[#F8F8FE] font-sans text-foreground antialiased selection:bg-primary/30">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <StatsBand />
        <ModulesGrid />
        <WhyUs />
        <DashboardShowcase />
        <HowItWorks />
        <MobileApps />
        <Testimonials />
        <TrustedBy />
        <Faq />
        <DemoCta />
      </main>
      <SiteFooter />
    </div>
  );
}
