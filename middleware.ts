import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Middleware gatar HELA appen från första request. Ingen route (dashboard,
 * /api/data, onboarding) renderas för en oinloggad besökare — de redirectas
 * till /login. Detta är det som gör Railway-deployen lösenordsskyddad från
 * första deploy (invariant 3), eftersom Railway saknar plattformsskydd.
 *
 * Vi instansierar NextAuth med den edge-säkra authConfig (utan providers).
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Kör på allt UTOM: NextAuth-endpoints, Next interna assets, favicon och
  // publika statiska assets (loggan) — annars gatas loggan bort på /login där
  // besökaren ännu inte är inloggad (→ trasig bild).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|nortropic-logo.png).*)"],
};
