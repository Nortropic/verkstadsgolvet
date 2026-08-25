/**
 * REN, INJICERBAR identitetsverifiering av det kanoniska researchkontraktet.
 *
 * Separerad från `index.ts` med avsikt: en vakt som bara kan köras mot de riktiga
 * modulkonstanterna går inte att driva i FÄLLANDE riktning från ett prov, och en
 * otestad vakt är en vakt som tyst kan tas bort. Här kan proven mata in drift.
 *
 * Fail-closed: varje avvikelse kastar. Ingen tyst fallback, ingen "senaste"-hämtning.
 */

import { createHash } from "crypto";

export class ResearchContractDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchContractDriftError";
  }
}

export type PackModule = { pack: string; version: string; motKarna: string; text: string };

export type ContractPin = {
  karna: { version: string; path: string; sha256: string };
  paketmoduler: { pack: string; version: string; motKarna: string; path: string; sha256: string }[];
};

export type DerivedContract = {
  coreVersion: string;
  coreText: string;
  modules: PackModule[];
};

export function sha256(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

/**
 * Prövar att kärnversionen ligger inom modulens deklarerade intervall `>=A <B`.
 * Endast den formen stöds — en okänd form är ett FEL, aldrig ett tyst godkännande.
 */
export function satisfiesRange(version: string, range: string): boolean {
  const m = /^>=(\d+)\.(\d+)\.(\d+)\s+<(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
  if (!m) return false;
  const v = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!v) return false;
  const num = (a: string, b: string, c: string) => Number(a) * 1e6 + Number(b) * 1e3 + Number(c);
  const cur = num(v[1], v[2], v[3]);
  return cur >= num(m[1], m[2], m[3]) && cur < num(m[4], m[5], m[6]);
}

/**
 * Verifierar att den härledda kopian är byte-identisk med pinnen och att
 * versionsintervallen håller. Kastar `ResearchContractDriftError` vid minsta avvikelse.
 */
export function verifyIdentity(derived: DerivedContract, pin: ContractPin): void {
  // ANKARKRAV (V4-läxan): en tom pinn får ALDRIG passera som "allt verifierat".
  // Utan detta är varje efterföljande loop-kontroll vacuöst sann.
  if (!pin.karna || typeof pin.karna.sha256 !== "string" || pin.karna.sha256.length !== 64) {
    throw new ResearchContractDriftError("Pinnen saknar en giltig kärn-hash — vägrar verifiera mot tomhet.");
  }
  if (!Array.isArray(pin.paketmoduler) || pin.paketmoduler.length === 0) {
    throw new ResearchContractDriftError(
      "Pinnen innehåller noll paketmoduler — en tom lista bevisar ingenting och får aldrig passera som verifierad."
    );
  }

  const gotCore = sha256(derived.coreText);
  if (gotCore !== pin.karna.sha256) {
    throw new ResearchContractDriftError(
      `Researchkontraktets kärna har driftat: ${gotCore.slice(0, 12)}… ≠ pinnad ${pin.karna.sha256.slice(0, 12)}…. ` +
        `Kör scripts/sync-research-contract.mjs mot en granskad nortropic-system-commit. Komponerar inte mot okänd text.`
    );
  }
  if (derived.coreVersion !== pin.karna.version) {
    throw new ResearchContractDriftError(
      `Kontraktsversionen säger ${derived.coreVersion} men pinnen säger ${pin.karna.version}.`
    );
  }
  if (derived.modules.length !== pin.paketmoduler.length) {
    throw new ResearchContractDriftError(
      `Antalet paketmoduler skiljer sig: härledd ${derived.modules.length} ≠ pinnad ${pin.paketmoduler.length}.`
    );
  }

  for (const pinned of pin.paketmoduler) {
    const mod = derived.modules.find((m) => m.pack === pinned.pack);
    if (!mod) {
      throw new ResearchContractDriftError(`Pinnad paketmodul saknas i den härledda kopian: ${pinned.pack}.`);
    }
    const got = sha256(mod.text);
    if (got !== pinned.sha256) {
      throw new ResearchContractDriftError(
        `Paketmodulen ${pinned.pack} har driftat: ${got.slice(0, 12)}… ≠ pinnad ${pinned.sha256.slice(0, 12)}….`
      );
    }
    if (mod.version !== pinned.version) {
      throw new ResearchContractDriftError(
        `Paketmodulen ${pinned.pack} säger v${mod.version} men pinnen säger v${pinned.version}.`
      );
    }
    // motKarna transporteras inte bara — den PRÖVAS. En modul mot fel kärnmajor
    // är en kompositionsdrift även när båda hasharna stämmer var för sig.
    if (mod.motKarna !== pinned.motKarna) {
      throw new ResearchContractDriftError(
        `Paketmodulen ${pinned.pack} deklarerar intervall ${mod.motKarna} men pinnen säger ${pinned.motKarna}.`
      );
    }
    if (!satisfiesRange(derived.coreVersion, pinned.motKarna)) {
      throw new ResearchContractDriftError(
        `Kärnversion ${derived.coreVersion} ligger utanför paketmodulen ${pinned.pack}:s intervall ${pinned.motKarna}.`
      );
    }
  }
}
