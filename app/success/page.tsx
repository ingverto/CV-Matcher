"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCredits() {
      try {
        if (!sessionId) {
          setError("Missing checkout session.");
          setLoading(false);
          return;
        }

        const resSession = await fetch("/api/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        const sessionText = await resSession.text();

        let sessionData: { email?: string; error?: string };
        try {
          sessionData = JSON.parse(sessionText);
        } catch {
          throw new Error("Session endpoint did not return valid JSON.");
        }

        if (!resSession.ok) {
          throw new Error(sessionData.error || "Failed to fetch session.");
        }

        if (!sessionData.email) {
          throw new Error("No email found for this checkout session.");
        }

        const normalizedEmail = sessionData.email.trim().toLowerCase();
        setEmail(normalizedEmail);

        const resCredits = await fetch("/api/credits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        const creditsText = await resCredits.text();

        let creditData: { credits?: number; error?: string };
        try {
          creditData = JSON.parse(creditsText);
        } catch {
          throw new Error("Credits endpoint did not return valid JSON.");
        }

        if (!resCredits.ok) {
          throw new Error(creditData.error || "Failed to fetch credits.");
        }

        setCredits(creditData.credits ?? 0);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Could not fetch updated credits."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCredits();
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
        <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Payment successful
        </div>

        <h1 className="text-3xl font-bold text-white">Thank you</h1>

        <p className="mt-4 leading-7 text-slate-300">
          Your payment was completed successfully.
        </p>

        {loading && (
          <p className="mt-4 text-slate-400">Fetching your updated credits...</p>
        )}

        {!loading && credits !== null && (
          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <div className="text-sm text-slate-300">Your updated balance</div>
            <div className="mt-2 text-3xl font-bold text-cyan-300">
              {credits} analyses
            </div>
            {email && <div className="mt-1 text-xs text-slate-400">{email}</div>}
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200">
            {error}
          </div>
        )}

        <a
          href="/"
          className="mt-8 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
        >
          Back to CV Matcher
        </a>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
          <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
            <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Payment successful
            </div>

            <h1 className="text-3xl font-bold text-white">Thank you</h1>

            <p className="mt-4 leading-7 text-slate-300">
              Finalizing your payment...
            </p>
          </div>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}