import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type AccessMode = "trial" | "buy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const accessMode = String(body.accessMode || "") as AccessMode;
    const jobDescription = String(body.jobDescription || "").trim();
    const cv = String(body.cv || "").trim();
    const email = String(body.email || "").trim().toLowerCase();

    if (accessMode !== "trial" && accessMode !== "buy") {
      return NextResponse.json({ error: "Invalid access mode." }, { status: 400 });
    }

    if (!jobDescription) {
      return NextResponse.json({ error: "Please provide a job description." }, { status: 400 });
    }

    if (!cv) {
      return NextResponse.json({ error: "Please provide a CV or resume." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Please enter your email." }, { status: 400 });
    }

    if (jobDescription.length > 20000) {
      return NextResponse.json({ error: "Job description is too long." }, { status: 400 });
    }

    if (cv.length > 20000) {
      return NextResponse.json({ error: "CV is too long." }, { status: 400 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("credits")
      .select("email, credits, free_trial_used")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      console.error("Failed to fetch user:", userError);
      return NextResponse.json({ error: "Failed to check user status." }, { status: 500 });
    }

    if (accessMode === "trial" && user?.free_trial_used) {
      return NextResponse.json(
        { error: "Your free trial has already been used." },
        { status: 403 }
      );
    }

    if (accessMode === "buy") {
      if (!user || user.credits < 1) {
        return NextResponse.json(
          { error: "You do not have enough credits." },
          { status: 403 }
        );
      }
    }

    const prompt = `
You are an expert resume matcher.

Compare the candidate CV against the job description.

Return ONLY valid JSON with this exact shape:
{
  "overallScore": number,
  "matchLevel": "Low" | "Medium" | "High",
  "strengths": string[],
  "gaps": string[],
  "missingKeywords": string[],
  "tailoredSummary": string,
  "interviewChance": string,
  "recommendation": string
}

Scoring rules:
- 80-100 = High
- 60-79 = Medium
- 0-59 = Low

Job description:
"""${jobDescription}"""

CV:
"""${cv}"""
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a precise hiring assistant that only returns valid JSON.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
    });

    const content = response.output_text;

    if (!content) {
      return NextResponse.json({ error: "No response from AI." }, { status: 500 });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse AI JSON:", content);
      return NextResponse.json({ error: "Invalid AI response format." }, { status: 500 });
    }

    if (accessMode === "trial") {
      const { error: trialUpdateError } = await supabaseAdmin.from("credits").upsert(
        {
          email,
          credits: user?.credits ?? 0,
          free_trial_used: true,
          free_trial_used_at: new Date().toISOString(),
        },
        {
          onConflict: "email",
        }
      );

      if (trialUpdateError) {
        console.error("Failed to mark trial as used:", trialUpdateError);
        return NextResponse.json(
          { error: "Analysis completed, but failed to save free trial status." },
          { status: 500 }
        );
      }
    }

    if (accessMode === "buy") {
      const { data: decrementSuccess, error: decrementError } = await supabaseAdmin.rpc(
        "decrement_credits",
        {
          user_email: email,
          amount: 1,
        }
      );

      if (decrementError) {
        console.error("Failed to decrement credits:", decrementError);
        return NextResponse.json(
          { error: "Analysis completed, but failed to decrement credits." },
          { status: 500 }
        );
      }

      if (decrementSuccess !== true) {
        return NextResponse.json(
          { error: "Could not deduct a credit. Please try again." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Match route failed:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}