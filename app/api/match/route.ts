import OpenAI from "openai";
import { NextResponse } from "next/server";

type MatchResult = {
  overallScore: number;
  matchLevel: "Low" | "Medium" | "High";
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
  tailoredSummary: string;
  interviewChance: string;
  recommendation: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const jobDescription = body?.jobDescription?.trim();
    const cv = body?.cv?.trim();
    const apiKey = body?.apiKey?.trim();

    if (!jobDescription || !cv) {
      return NextResponse.json(
        { error: "Both the job description and CV are required." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No API key provided. Enter your OpenAI API key to run the analysis.",
        },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey,
    });

    const prompt = `
You are an expert recruiter and CV matcher.

Compare the candidate's CV with the job description and return ONLY valid JSON.

Requirements:
- Return only JSON
- No markdown
- No extra text
- overallScore must be an integer between 0 and 100
- matchLevel must be exactly "Low", "Medium", or "High"

JSON format:
{
  "overallScore": 0,
  "matchLevel": "Low",
  "strengths": ["..."],
  "gaps": ["..."],
  "missingKeywords": ["..."],
  "tailoredSummary": "...",
  "interviewChance": "...",
  "recommendation": "..."
}

Job Description:
${jobDescription}

CV:
${cv}
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return NextResponse.json(
        { error: "Empty response from the model." },
        { status: 500 }
      );
    }

    let parsed: MatchResult;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: "The model did not return valid JSON.",
          raw,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("API error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Something went wrong while calling OpenAI.",
      },
      { status: 500 }
    );
  }
}