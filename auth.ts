import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

/**
 * Full NextAuth-konfiguration (Node-runtime). Används av route-handlern och av
 * server-side `auth()`-anrop. Middleware använder INTE denna — den använder
 * auth.config.ts (edge-säker) för att slippa Credentials-providerns Node-beroenden.
 *
 * En enda intern användare (Johnny). Inga lösenord i koden — endast jämförelse
 * mot server-side env (AUTH_USERNAME / AUTH_PASSWORD). Inget databaslager.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Användarnamn", type: "text" },
        password: { label: "Lösenord", type: "password" },
      },
      authorize: async (credentials) => {
        const expectedUser = process.env.AUTH_USERNAME;
        const expectedPass = process.env.AUTH_PASSWORD;

        // Om creds saknas i env: neka allt (säkrare än att släppa in).
        if (!expectedUser || !expectedPass) return null;

        const username =
          typeof credentials?.username === "string" ? credentials.username : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (username === expectedUser && password === expectedPass) {
          return { id: "johnny", name: expectedUser };
        }
        return null;
      },
    }),
  ],
});
