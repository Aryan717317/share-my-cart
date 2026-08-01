import { notFound } from "next/navigation";
import { getSharedCart } from "@/lib/store";
import { buildBulkAddToCartUrl, buildSingleItemUrl } from "@/lib/amazon";

export default function SharedCartPage({ params }: { params: { token: string } }) {
  const cart = getSharedCart(params.token);

  if (!cart) {
    notFound();
  }

  const addAllUrl = buildBulkAddToCartUrl(cart.items, cart.domain);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px 80px" }}>
      <p
        style={{
          fontSize: 13,
          color: "var(--muted)",
          letterSpacing: 1,
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Shared cart &middot; {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
      </p>
      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: "8px 0 28px" }}>
        Someone shared their cart with you.
      </h1>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--line)" }}>
        {cart.items.map((item) => (
          <li
            key={item.asin}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              padding: "16px 0",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div>
              <div style={{ fontSize: 15, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Qty {item.quantity}
                {item.price ? ` · ${item.price}` : ""}
              </div>
            </div>
            <a
              href={buildSingleItemUrl(item.asin, item.quantity, cart.domain)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                color: "var(--amazon-dark)",
                whiteSpace: "nowrap",
                paddingTop: 2,
              }}
            >
              Add this one
            </a>
          </li>
        ))}
      </ul>

      <a
        href={addAllUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          textAlign: "center",
          marginTop: 32,
          padding: "14px 20px",
          borderRadius: 10,
          background: "var(--amazon)",
          color: "var(--ink)",
          fontWeight: 700,
          fontSize: 15,
          textDecoration: "none",
        }}
      >
        Add all {cart.items.length} to my cart
      </a>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>
        Opens Amazon and adds these items to whichever account you&apos;re logged into there.
      </p>
    </main>
  );
}
