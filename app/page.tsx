import { auth, signIn } from "@/auth";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { FooterCta } from "@/components/landing/footer-cta";
import { FormatShowcase } from "@/components/landing/format-showcase";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { NavBar } from "@/components/landing/nav-bar";

export default async function Page() {
  const session = await auth();
  const isSignedIn = !!session;

  async function handleSignIn() {
    "use server";
    await signIn("rxlab");
  }

  return (
    <div className="min-h-svh">
      <NavBar isSignedIn={isSignedIn} signInAction={handleSignIn} />
      <HeroSection isSignedIn={isSignedIn} signInAction={handleSignIn} />
      <HowItWorks />
      <FeatureGrid />
      <FormatShowcase />
      <FooterCta isSignedIn={isSignedIn} signInAction={handleSignIn} />
    </div>
  );
}
