import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_IS_E2E: process.env.IS_E2E ?? "",
  },
};

export default nextConfig;
