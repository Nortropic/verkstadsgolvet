import { handlers } from "@/auth";

// NextAuth v5 route-handlers (Node-runtime). Hanterar sign-in/sign-out/session
// under /api/auth/*. Denna path är undantagen i middleware-matchern.
export const { GET, POST } = handlers;
