import path from "node:path";
import type { NextConfig } from "next";
import { CDN_HOSTS } from "./lib/cdn-hosts";

// Static security headers for every response (pages, API routes, static
// files). The Content-Security-Policy itself is per-request (it carries a
// nonce) and is set in proxy.ts.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // Traces the real runtime dependency graph into .next/standalone as
  // concrete files instead of relying on Bun's workspace symlinks (see
  // Dockerfile). Required in this monorepo, not just an optimization.
  output: "standalone",
  // The app imports packages/docs-engine and reads ../../docs, so tracing
  // and Turbopack both need the repo root, not just this folder.
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  images: {
    // next/image only optimizes images from the Hack Club CDN.
    remotePatterns: CDN_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
  },
  experimental: {
    serverActions: {
      // Project screenshots are uploaded through a Server Action; the server
      // itself caps images at 15MB (apps/server/src/routes/uploads.ts).
      bodySizeLimit: "16mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [{ source: "/sidequests", destination: "/trials", permanent: false }];
  },
};

export default nextConfig;
