"use client";

import { useState } from "react";

/**
 * Kopierbart dokument-block (återanvänder .onb-step/.copy-btn/.prompt-box).
 * Audience-badge: "Till dig" (accent) för prompten, "Till kunden" (success) för guider.
 */
export default function CopyBlock({
  title,
  description,
  audience,
  content,
}: {
  title: string;
  description: string;
  audience: "dig" | "kund";
  content: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blockerad — användaren kan markera texten och kopiera manuellt */
    }
  }

  return (
    <div className="onb-step" style={{ marginBottom: 16 }}>
      <div className="onb-step-head">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          {title}
          <span className={`badge ${audience === "dig" ? "accent" : "success"}`}>
            {audience === "dig" ? "Till dig" : "Till kunden"}
          </span>
        </span>
        <button type="button" className="copy-btn" onClick={copy}>
          {copied ? "✓ Kopierad" : "Kopiera"}
        </button>
      </div>
      <div className="onb-status" style={{ marginTop: 0, marginBottom: 10 }}>{description}</div>
      <textarea
        className="prompt-box"
        readOnly
        value={content}
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}
