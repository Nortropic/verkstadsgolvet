/**
 * Nortropic-loggan (wordmark "NORTROP\C", cream på #1a1a19). Ersätter det tidigare
 * abstrakta märket. Storlek styrs av wrapper-klassen (.sidebar-logo / .login-logo).
 * Plain <img> — liten statisk PNG i /public, blandar sömlöst mot page-bg.
 */
export default function NortropicLogo({ alt = "Nortropic" }: { alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/nortropic-logo.png" alt={alt} />;
}
