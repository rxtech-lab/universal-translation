import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_IS_E2E: process.env.IS_E2E ?? "",
  },
};

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./i18n/request.ts",
  experimental: {
    srcPath: ["./app", "./components", "./lib"],
    extract: {
      sourceLocale: "en",
    },
    messages: {
      format: "po",
      locales: ["en", "zh"],
      path: "./messages",
    },
  },
});

export default withNextIntl(nextConfig);
