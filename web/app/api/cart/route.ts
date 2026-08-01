import { NextRequest, NextResponse } from "next/server";
import { createSharedCart, type CartItem } from "@/lib/store";

// The extension calls this from a chrome-extension:// origin. host_permissions
// in manifest.json lets Chrome bypass CORS for it, but that only helps if the
// manifest and the deployed backend URL stay in sync — these headers are a
// second line of defense so the request still succeeds either way.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const MAX_ITEMS_PER_CART = 50;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items array is required" }, { status: 400, headers: CORS_HEADERS });
  }

  if (body.items.length > MAX_ITEMS_PER_CART) {
    return NextResponse.json(
      { error: `a cart can have at most ${MAX_ITEMS_PER_CART} items` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const items: CartItem[] = body.items
    .filter((it: any) => typeof it?.asin === "string" && it.asin.length > 0)
    .map((it: any) => ({
      asin: it.asin,
      title: typeof it.title === "string" ? it.title : "Item",
      price: typeof it.price === "string" ? it.price : null,
      quantity: Number.isFinite(it.quantity) && it.quantity > 0 ? Math.floor(it.quantity) : 1,
    }));

  if (items.length === 0) {
    return NextResponse.json({ error: "no valid items in payload" }, { status: 400, headers: CORS_HEADERS });
  }

  const domain = typeof body.domain === "string" ? body.domain : "www.amazon.com";
  const cart = createSharedCart(items, domain);

  if (cart.items.length === 0) {
    return NextResponse.json(
      { error: "none of the items had a valid ASIN" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const shareUrl = `${baseUrl.replace(/\/$/, "")}/cart/${cart.token}`;

  return NextResponse.json({ token: cart.token, shareUrl }, { status: 201, headers: CORS_HEADERS });
}
