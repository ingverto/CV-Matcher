"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type MatchResponse = {
  overallScore: number;
  matchLevel: "Low" | "Medium" | "High";
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
  tailoredSummary: string;
  interviewChance: string;
  recommendation: string;
};

type UploadTarget = "job" | "cv";
type InputMode = "text" | "pdf";

type PdfState = {
  fileName: string;
  extractedText: string;
};

export default function HomePage() {
  const [jobInputMode, setJobInputMode] = useState<InputMode>("text");
  const [cvInputMode, setCvInputMode] = useState<InputMode>("text");

  const [jobText, setJobText] = useState("");
  const [cvText, setCvText] = useState("");

  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [jobPdf, setJobPdf] = useState<PdfState | null>(null);
  const [cvPdf, setCvPdf] = useState<PdfState | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState<UploadTarget | null>(null);
  const [error, setError] = useState("");

  const jobPdfInputRef = useRef<HTMLInputElement | null>(null);
  const cvPdfInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveJobDescription = useMemo(() => {
    return jobInputMode === "pdf" ? jobPdf?.extractedText ?? "" : jobText;
  }, [jobInputMode, jobPdf, jobText]);

  const effectiveCv = useMemo(() => {
    return cvInputMode === "pdf" ? cvPdf?.extractedText ?? "" : cvText;
  }, [cvInputMode, cvPdf, cvText]);

  async function extractTextFromPdf(file: File): Promise<string> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
    }).promise;

    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const text = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (text) {
        pageTexts.push(text);
      }
    }

    return pageTexts.join("\n\n");
  }

  async function fetchCredits(email: string) {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        setCreditsLeft(null);
        return;
      }

      const res = await fetch("/api/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch credits.");
      }

      setCreditsLeft(data.credits);
    } catch (err) {
      console.error(err);
      setCreditsLeft(null);
    }
  }

  async function handlePdfUpload(file: File, target: UploadTarget) {
    try {
      setError("");
      setExtracting(target);

      if (file.type !== "application/pdf") {
        throw new Error("The file must be a PDF.");
      }

      const extractedText = await extractTextFromPdf(file);

      if (!extractedText.trim()) {
        throw new Error("Could not extract any text from the PDF.");
      }

      if (target === "job") {
        setJobPdf({
          fileName: file.name,
          extractedText,
        });
      } else {
        setCvPdf({
          fileName: file.name,
          extractedText,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the PDF file.");
    } finally {
      setExtracting(null);
    }
  }

  function clearJobInput() {
    setJobText("");
    setJobPdf(null);
    setResult(null);
    setError("");
  }

  function clearCvInput() {
    setCvText("");
    setCvPdf(null);
    setResult(null);
    setError("");
  }

  function switchJobMode(mode: InputMode) {
    setJobInputMode(mode);
    setResult(null);
    setError("");
  }

  function switchCvMode(mode: InputMode) {
    setCvInputMode(mode);
    setResult(null);
    setError("");
  }

  async function handleBuyCredits(pack: "10" | "20") {
    try {
      setError("");

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pack,
          email: userEmail.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown checkout error.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      if (!userEmail.trim()) {
        throw new Error("Please enter your email.");
      }

      if (!effectiveJobDescription.trim()) {
        throw new Error("Please provide a job description.");
      }

      if (!effectiveCv.trim()) {
        throw new Error("Please provide a CV or resume.");
      }

      const res = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription: effectiveJobDescription,
          cv: effectiveCv,
          email: userEmail.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setResult(data);
      await fetchCredits(userEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  function scoreColor(score: number) {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-300";
    return "text-rose-400";
  }

  function badgeClasses(level: MatchResponse["matchLevel"]) {
    if (level === "High") {
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    }
    if (level === "Medium") {
      return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
    }
    return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  }

  const isBusy = loading || extracting !== null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-2xl">
          <div className="grid gap-8 p-6 md:grid-cols-[1.4fr_0.8fr] md:p-10">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                AI Resume Matching
              </div>

              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">
                CV Matcher
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                Match a resume against a job description with AI. Paste text or upload PDFs
                and get a clear score, gap analysis, and recommendation.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Text input
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  PDF upload
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  AI scoring
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Gap analysis
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-sm font-medium text-slate-300">How it works</div>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="font-semibold text-white">1. Enter your email</div>
                  <div className="mt-1 text-slate-300">
                    New users get 1 free analysis automatically.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="font-semibold text-white">2. Add job description and CV</div>
                  <div className="mt-1 text-slate-300">Paste text or upload PDF files.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="font-semibold text-white">3. Run the analysis</div>
                  <div className="mt-1 text-slate-300">
                    If free usage is gone, available credits are used automatically.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <h2 className="text-lg font-semibold text-white">Start your analysis</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              Enter your email to begin. New users get 1 free analysis automatically.
              After that, available credits will be used.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Your email
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                onBlur={() => {
                  if (userEmail.trim()) {
                    void fetchCredits(userEmail);
                  }
                }}
                placeholder="Enter your email"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </div>

            {creditsLeft !== null && (
              <div className="mt-4 inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-slate-200">
                {userEmail.trim().toLowerCase()} · {creditsLeft} analyses left
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <h2 className="text-lg font-semibold text-white">Need more analyses?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              Buy credits anytime and they will be connected to your email automatically.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm text-slate-400">Starter pack</div>
                <div className="mt-2 text-2xl font-bold text-white">10 analyses</div>
                <div className="mt-1 text-sm text-slate-300">5 SEK</div>
                <button
                  type="button"
                  onClick={() => handleBuyCredits("10")}
                  className="mt-4 inline-flex rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Buy 10 analyses
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm text-slate-400">Value pack</div>
                <div className="mt-2 text-2xl font-bold text-white">20 analyses</div>
                <div className="mt-1 text-sm text-slate-300">10 SEK</div>
                <button
                  type="button"
                  onClick={() => handleBuyCredits("20")}
                  className="mt-4 inline-flex rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Buy 20 analyses
                </button>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Job Description</h2>
                <p className="text-sm text-slate-400">Choose text input or upload a PDF.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchJobMode("text")}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    jobInputMode === "text"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Text
                </button>

                <button
                  type="button"
                  onClick={() => switchJobMode("pdf")}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    jobInputMode === "pdf"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  PDF
                </button>
              </div>
            </div>

            {jobInputMode === "text" ? (
              <>
                <textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="min-h-[420px] w-full rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                />
                <div className="mt-3 text-xs text-slate-500">{jobText.length} characters</div>
              </>
            ) : (
              <>
                <input
                  ref={jobPdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handlePdfUpload(file, "job");
                    }
                    e.currentTarget.value = "";
                  }}
                />

                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => jobPdfInputRef.current?.click()}
                      className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                    >
                      {extracting === "job" ? "Reading PDF..." : "Upload PDF"}
                    </button>

                    <button
                      type="button"
                      onClick={clearJobInput}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    {jobPdf ? (
                      <>
                        <div className="font-medium text-white">PDF uploaded</div>
                        <div className="mt-1 text-slate-400">{jobPdf.fileName}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-white">No PDF uploaded yet</div>
                        <div className="mt-1 text-slate-400">
                          Upload a job description PDF. The extracted text will be used in the
                          analysis without being shown here.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">CV / Resume</h2>
                <p className="text-sm text-slate-400">Choose text input or upload a PDF.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchCvMode("text")}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    cvInputMode === "text"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Text
                </button>

                <button
                  type="button"
                  onClick={() => switchCvMode("pdf")}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    cvInputMode === "pdf"
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  PDF
                </button>
              </div>
            </div>

            {cvInputMode === "text" ? (
              <>
                <textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Paste the CV or resume here..."
                  className="min-h-[420px] w-full rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                />
                <div className="mt-3 text-xs text-slate-500">{cvText.length} characters</div>
              </>
            ) : (
              <>
                <input
                  ref={cvPdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handlePdfUpload(file, "cv");
                    }
                    e.currentTarget.value = "";
                  }}
                />

                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => cvPdfInputRef.current?.click()}
                      className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                    >
                      {extracting === "cv" ? "Reading PDF..." : "Upload PDF"}
                    </button>

                    <button
                      type="button"
                      onClick={clearCvInput}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    {cvPdf ? (
                      <>
                        <div className="font-medium text-white">PDF uploaded</div>
                        <div className="mt-1 text-slate-400">{cvPdf.fileName}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-white">No PDF uploaded yet</div>
                        <div className="mt-1 text-slate-400">
                          Upload a CV or resume PDF. The extracted text will be used in the
                          analysis without being shown here.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <div className="xl:col-span-2">
            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-xl backdrop-blur">
              <button
                type="submit"
                disabled={isBusy}
                className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Analyze CV"}
              </button>

              <div className="text-sm text-slate-400">
                {extracting
                  ? "Reading PDF..."
                  : loading
                  ? "AI is analyzing the match..."
                  : creditsLeft !== null
                  ? `${creditsLeft} analyses available`
                  : "Enter your email to start"}
              </div>
            </div>
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200">
            {error}
          </div>
        )}

        {result && (
          <section className="mt-8 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                      Result
                    </p>
                    <h2 className="mt-1 text-3xl font-bold text-white">
                      AI-powered match assessment
                    </h2>
                    <p className="mt-2 max-w-2xl text-slate-400">
                      A quick overview of how well the resume matches the role.
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ring-1 ${badgeClasses(
                      result.matchLevel
                    )}`}
                  >
                    {result.matchLevel} match
                  </span>
                </div>

                <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                  <div className="text-sm text-slate-400">Overall Score</div>
                  <div className={`mt-2 text-6xl font-bold ${scoreColor(result.overallScore)}`}>
                    {result.overallScore}
                    <span className="text-2xl text-slate-400">/100</span>
                  </div>

                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, result.overallScore))}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white">Interview Chance</h3>
                <p className="mt-3 leading-7 text-slate-300">{result.interviewChance}</p>

                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-sm font-medium text-slate-400">Recommendation</div>
                  <p className="mt-2 leading-7 text-slate-300">{result.recommendation}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white">Strengths</h3>
                <ul className="mt-4 space-y-3">
                  {result.strengths.map((item, index) => (
                    <li
                      key={`strength-${index}`}
                      className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4 text-sm leading-6 text-slate-200"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white">Gaps</h3>
                <ul className="mt-4 space-y-3">
                  {result.gaps.map((item, index) => (
                    <li
                      key={`gap-${index}`}
                      className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4 text-sm leading-6 text-slate-200"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white">Missing Keywords</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.missingKeywords.map((item, index) => (
                    <span
                      key={`keyword-${index}`}
                      className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white">Tailored Summary</h3>
                <p className="mt-4 leading-8 text-slate-300">{result.tailoredSummary}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white">Quick interpretation</h3>
                <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                  <p>
                    <span className="font-semibold text-white">80–100:</span> strong match for
                    the role.
                  </p>
                  <p>
                    <span className="font-semibold text-white">60–79:</span> relevant profile
                    with clear gaps.
                  </p>
                  <p>
                    <span className="font-semibold text-white">0–59:</span> low match or wrong
                    seniority level.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}