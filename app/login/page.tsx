"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      username: String(fd.get("username") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirect: false,
    });

    setLoading(false);

    if (!res || res.error) {
      setError("Fel användarnamn eller lösenord.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <BrandMark sub="Intern · logga in" />
        <form onSubmit={onSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="username">Användarnamn</label>
            <input id="username" name="username" type="text" autoComplete="username" required autoFocus />
          </div>
          <div className="login-field">
            <label htmlFor="password">Lösenord</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Loggar in…" : "Logga in"}
          </button>
          {error && <div className="login-err" role="alert">{error}</div>}
        </form>
      </div>
    </main>
  );
}
