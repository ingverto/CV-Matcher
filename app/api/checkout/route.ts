import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pack = String(body.pack || "");

    let unitAmount = 0;
    let label = "";

    if (pack === "10") {
      unitAmount = 500;
      label = "10 CV analyses";
    } else if (pack === "20") {
      unitAmount = 1000;
      label = "20 CV analyses";
    } else {
      return NextResponse.json({ error: "Invalid pack." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_creation: "always",
      billing_address_collection: "auto",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "sek",
            unit_amount: unitAmount,
            product_data: {
              name: label,
            },
          },
        },
      ],
      metadata: {
        pack,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout failed:", error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}