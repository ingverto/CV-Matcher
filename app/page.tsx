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
type AccessMode = "own-key" | "demo";

type PdfState = {
  fileName: string;
  extractedText: string;
};

export default function HomePage() {
  const [accessMode, setAccessMode] = useState<AccessMode>("own-key");
  const [apiKey, setApiKey] = useState("");

  const [jobInputMode, setJobInputMode] = useState<InputMode>("text");
  const [cvInputMode, setCvInputMode] = useState<InputMode>("text");

  const [jobText, setJobText] = useState("");
  const [cvText, setCvText] = useState("");

  const [jobPdf, setJobPdf] = useState<PdfState | null>(null);
  const [cvPdf, setCvPdf] = useState<PdfState | null>(null);

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
  }

  function clearCvInput() {
    setCvText("");
    setCvPdf(null);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      if (accessMode === "own-key" && !apiKey.trim()) {
        throw new Error("Please enter your OpenAI API key.");
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
          apiKey: accessMode === "own-key" ? apiKey : "",
          jobDescription: effectiveJobDescription,
          cv: effectiveCv,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setResult(data);
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
                Match a resume against a job description with AI. Paste text or upload
                PDFs and get a clear score, gap analysis, and recommendation.
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
                  <div className="font-semibold text-white">1. Add a job description</div>
                  <div className="mt-1 text-slate-300">
                    Choose text or PDF upload.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="font-semibold text-white">2. Add a CV or resume</div>
                  <div className="mt-1 text-slate-300">
                    Paste text or upload a PDF file.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="font-semibold text-white">3. Run the analysis</div>
                  <div className="mt-1 text-slate-300">
                    Get a score, missing keywords, strengths, gaps, and a recommendation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAccessMode("own-key")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                accessMode === "own-key"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              Use your own API key
            </button>

            <button
              type="button"
              onClick={() => setAccessMode("demo")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                accessMode === "demo"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              Request demo access
            </button>
          </div>

          {accessMode === "own-key" ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <h2 className="text-lg font-semibold text-white">Your OpenAI API key</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
                Enter your own OpenAI API key to run the analysis. The key is only
                used for the request and is not stored in a database.
              </p>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  OpenAI API key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <h2 className="text-lg font-semibold text-white">Want to try it?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
                If you want to test the tool but do not have your own OpenAI API key,
                contact me on GitHub and I can help you get started.
              </p>

              <a
                href="https://github.com/ingverto"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Contact me on GitHub
              </a>
            </div>
          )}
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Job Description</h2>
                <p className="text-sm text-slate-400">
                  Choose text input or upload a PDF.
                </p>
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
                          Upload a job description PDF. The extracted text will be used in
                          the analysis without being shown here.
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
                <p className="text-sm text-slate-400">
                  Choose text input or upload a PDF.
                </p>
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
                          Upload a CV or resume PDF. The extracted text will be used in
                          the analysis without being shown here.
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
                disabled={isBusy || accessMode === "demo"}
                className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Match CV"}
              </button>

              <div className="text-sm text-slate-400">
                {extracting
                  ? "Reading PDF..."
                  : loading
                  ? "AI is analyzing the match..."
                  : accessMode === "demo"
                  ? "Demo mode selected"
                  : "Ready"}
              </div>
            </div>
          </div>
        </form>

        {accessMode === "demo" && (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
            Demo mode does not run the analysis. Use your own API key or contact me on
            GitHub for access.
          </div>
        )}

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
                    <span className="font-semibold text-white">80–100:</span> strong match
                    for the role.
                  </p>
                  <p>
                    <span className="font-semibold text-white">60–79:</span> relevant profile
                    with clear gaps.
                  </p>
                  <p>
                    <span className="font-semibold text-white">0–59:</span> low match or
                    wrong seniority level.
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