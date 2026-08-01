import { NextRequest, NextResponse } from "next/server";
import { getSharedCart } from "@/lib/store";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const cart = getSharedCart(params.token);

  if (!cart) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(cart);
}
