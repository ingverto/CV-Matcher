import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Invalid webhook signature:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const { data: existingEvent, error: existingEventError } = await supabaseAdmin
      .from("processed_stripe_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEventError) {
      console.error("Failed to check processed event:", existingEventError);
      return NextResponse.json({ error: "Failed to check event." }, { status: 500 });
    }

    if (existingEvent) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email =
        session.customer_details?.email?.trim().toLowerCase() ||
        session.customer_email?.trim().toLowerCase();

      const pack = session.metadata?.pack;

      if (!email) {
        return NextResponse.json({ error: "Missing customer email." }, { status: 400 });
      }

      let creditsToAdd = 0;

      if (pack === "10") {
        creditsToAdd = 10;
      } else if (pack === "20") {
        creditsToAdd = 20;
      } else {
        return NextResponse.json({ error: "Invalid pack metadata." }, { status: 400 });
      }

      const { error: upsertError } = await supabaseAdmin.from("credits").upsert(
        {
          email,
          credits: creditsToAdd,
        },
        {
          onConflict: "email",
          ignoreDuplicates: false,
        }
      );

      if (upsertError) {
        const { data: currentUser, error: fetchError } = await supabaseAdmin
          .from("credits")
          .select("credits")
          .eq("email", email)
          .maybeSingle();

        if (fetchError) {
          console.error("Failed to fetch user after upsert error:", fetchError);
          return NextResponse.json({ error: "Failed to update credits." }, { status: 500 });
        }

        const newCredits = (currentUser?.credits ?? 0) + creditsToAdd;

        const { error: updateError } = await supabaseAdmin
          .from("credits")
          .update({ credits: newCredits })
          .eq("email", email);

        if (updateError) {
          console.error("Failed to increment credits:", updateError);
          return NextResponse.json({ error: "Failed to increment credits." }, { status: 500 });
        }
      }

      const { error: eventInsertError } = await supabaseAdmin
        .from("processed_stripe_events")
        .insert({
          event_id: event.id,
          event_type: event.type,
        });

      if (eventInsertError) {
        console.error("Failed to save processed event:", eventInsertError);
        return NextResponse.json({ error: "Failed to save processed event." }, { status: 500 });
      }

      const { data: finalUser, error: finalUserError } = await supabaseAdmin
        .from("credits")
        .select("credits")
        .eq("email", email)
        .maybeSingle();

      if (finalUserError) {
        console.error("Failed to fetch final credit balance:", finalUserError);
      }

      console.log("Payment completed");
      console.log("Credits bought:", creditsToAdd);
      console.log("Pack:", pack);
      console.log("Customer email:", email);
      console.log("New credit balance:", finalUser?.credits ?? "unknown");
    } else {
      const { error: eventInsertError } = await supabaseAdmin
        .from("processed_stripe_events")
        .insert({
          event_id: event.id,
          event_type: event.type,
        });

      if (eventInsertError) {
        console.error("Failed to save processed non-checkout event:", eventInsertError);
        return NextResponse.json({ error: "Failed to save processed event." }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}