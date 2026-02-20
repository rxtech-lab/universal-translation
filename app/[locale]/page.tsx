import { cookies } from "next/headers";
import { getExtracted } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { auth, signIn } from "@/auth";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { FooterCta } from "@/components/landing/footer-cta";
import { FormatShowcase } from "@/components/landing/format-showcase";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { NavBar } from "@/components/landing/nav-bar";
import { getWaitingListStatus } from "@/app/actions/waiting-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    title: t("Universal Translation — AI-Powered Software Localization"),
    description: t(
      "Upload .xcloc, .srt, .po, .md, .txt, and .docx files. Get context-aware, terminology-consistent AI translations in seconds. Built for developers and translators.",
    ),
    alternates: {
      canonical: "/",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  const session = await auth();
  const isSignedIn = !!session;

  const waitingListEnabled = process.env.IS_WAITING_LIST_ENABLE === "true";

  const cookieStore = await cookies();
  const waitingListEmail = cookieStore.get("waiting_list_email")?.value ?? "";

  const { onList: isOnWaitingList, approved: isApproved } =
    waitingListEnabled && waitingListEmail
      ? await getWaitingListStatus(waitingListEmail)
      : { onList: false, approved: false };

  async function handleSignIn() {
    "use server";
    await signIn("rxlab");
  }

  const ctaProps = {
    isSignedIn,
    signInAction: handleSignIn,
    waitingListEnabled,
    isOnWaitingList,
    isApproved,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Universal Translation",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: t(
      "AI-powered translation platform for software localization. Supports Xcode .xcloc catalogs, .srt subtitles, .po gettext files, Markdown, plain text, and Word documents.",
    ),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Multi-format support (.xcloc, .srt, .po, .md, .txt, .docx)",
      "LLM-powered context-aware translation",
      "Terminology consistency via custom glossary",
      "Cloud project save",
      "Subtitle and lyrics intelligence",
    ],
    creator: {
      "@type": "Organization",
      name: "RxLab",
    },
  };

  return (
    <div className="min-h-svh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar isSignedIn={isSignedIn} signInAction={handleSignIn} />
      <HeroSection {...ctaProps} />
      <HowItWorks />
      <FeatureGrid />
      <FormatShowcase />
      <FooterCta {...ctaProps} />
    </div>
  );
}
