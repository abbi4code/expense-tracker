import type { NextConfig } from "next";

// Changes on every deploy so the service worker URL changes and clients get an update prompt.
const appVersion =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? Date.now().toString(36);

const nextConfig: NextConfig = {
  // Lets `npm run dev` be opened through a tunnel (e.g. on a phone): see `npm run tunnel`.
  allowedDevOrigins: ["*.trycloudflare.com"],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
