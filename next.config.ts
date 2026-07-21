import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway kör `next start` bakom sin egen proxy; NextAuth v5 behöver lita på host-headern.
  // Inga hemligheter exponeras här — allt känsligt läses server-side via process.env.
  reactStrictMode: true,
};

export default nextConfig;
