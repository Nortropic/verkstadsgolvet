import type { NextAuthConfig } from "next-auth";

/**
 * Edge-säker delkonfiguration. Innehåller INGA providers (Credentials-providern
 * har Node-beroenden) — bara det som måste köra i middleware på Edge-runtime.
 * `authorized`-callbacken är porten: allt utom /login kräver inloggning.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  // Railway sitter bakom en proxy — lita på host-headern så NextAuth bygger rätt URL:er.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        // Redan inloggad som besöker /login → skicka till dashboarden.
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true; // släpp fram login-sidan för oinloggade
      }

      // Alla andra routes (dashboard, /api/data, onboarding …) kräver session.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
