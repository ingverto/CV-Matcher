import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("credits")
      .select("credits")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Credits lookup failed:", error);
      return NextResponse.json({ error: "Failed to fetch credits." }, { status: 500 });
    }

    return NextResponse.json({
      credits: data?.credits ?? 0,
    });
  } catch (error) {
    console.error("Credits route failed:", error);
    return NextResponse.json({ error: "Failed to fetch credits." }, { status: 500 });
  }
}