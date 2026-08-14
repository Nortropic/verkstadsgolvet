import type { NextConfig } from "next";

/**
 * V10 · SÄKERHETSHÄRDNING — konfigurationen som en STÄNGD dörr, inte som en default.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md §V10 (X1 "noll förekomster … i klientbundlen",
 * X2 "noll NEXT_PUBLIC_*") och AUTH_SECURITY ("Alla hemligheter server-only").
 *
 * Två konfigurationsvägar — och bara två — kan flytta ett serverhemligt värde in i
 * klientbundlen: `env:`/`publicRuntimeConfig:` (värdet bakas in vid build) och källkartor
 * (serverkodens strängar följer med ut). Ingen av dem finns här, och tests/loop/
 * v10-security-hardening.test.ts mäter statiskt att de inte smyger in igen.
 *
 * Filen får därför ALDRIG innehålla `env:`, `publicRuntimeConfig:` eller NEXT_PUBLIC_*.
 * Allt känsligt läses server-side via process.env i server-only-moduler.
 */
const nextConfig: NextConfig = {
  // Railway kör `next start` bakom sin egen proxy; NextAuth v5 behöver lita på host-headern.
  // Inga hemligheter exponeras här — allt känsligt läses server-side via process.env.
  reactStrictMode: true,

  // UTTALAT AV, inte "av som default": källkartor i produktionsbundlen vidgar den yta som
  // X1 mäts över och kan bära serverkodens strängar till klienten.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
