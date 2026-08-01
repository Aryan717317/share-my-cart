import type { CartItem } from "@/lib/store";

/**
 * Builds Amazon's public "Remote Shopping Cart" URL: a documented, unauthenticated
 * endpoint (part of the Associates program) that adds ASIN/quantity pairs to the
 * cart of whichever browser opens it — using that browser's own logged-in session.
 *
 * https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=XXXX&Quantity.1=2&ASIN.2=YYYY...
 *
 * No credentials or cookies are read or sent by us — Amazon handles the login
 * check entirely on their own end when the recipient opens this link.
 */
export function buildBulkAddToCartUrl(items: CartItem[], domain: string): string {
  const base = domain.includes("amazon.in") ? "https://www.amazon.in" : "https://www.amazon.com";
  const params = new URLSearchParams();

  items.forEach((item, i) => {
    const n = i + 1;
    params.set(`ASIN.${n}`, item.asin);
    params.set(`Quantity.${n}`, String(item.quantity));
  });

  return `${base}/gp/aws/cart/add.html?${params.toString()}`;
}

/** Single-item fallback link, for when someone wants to add just one thing. */
export function buildSingleItemUrl(asin: string, quantity: number, domain: string): string {
  const base = domain.includes("amazon.in") ? "https://www.amazon.in" : "https://www.amazon.com";
  return `${base}/gp/aws/cart/add.html?ASIN.1=${encodeURIComponent(asin)}&Quantity.1=${quantity}`;
}
