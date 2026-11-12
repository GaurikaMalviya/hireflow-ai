"use client";

import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-xs">
            H
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">HireFlow AI</h1>
            <p className="text-xs text-slate-500">AI Job Matching Platform</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Enter your team passcode to access the campus placement dashboard and Gemini Career Assistant.
        </p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
          placeholder="Team Passcode"
          autoFocus
        />
        {error && <p className="mt-2.5 text-xs text-red-600 font-medium">{error}</p>}
        <button
          type="submit"
          disabled={loading || !passcode}
          className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
        >
          {loading ? "Verifying..." : "Enter Platform"}
        </button>
      </form>
    </main>
  );
}
