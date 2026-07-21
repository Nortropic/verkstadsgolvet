/**
 * Nortropic-loggan (wordmark "NORTROP\C", cream på #1a1815). Storlek styrs av
 * wrapper-klassen (.sidebar-logo / .login-logo). Plain <img> — statisk PNG i /public.
 * src default = fulla loggan (login); sidebaren skickar den tight-croppade marken
 * så wordmarken kan ligga flush-vänster.
 */
export default function NortropicLogo({
  alt = "Nortropic",
  src = "/nortropic-logo.png",
}: {
  alt?: string;
  src?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />;
}
