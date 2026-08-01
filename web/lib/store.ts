import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

export type CartItem = {
  asin: string;
  title: string;
  price: string | null;
  quantity: number;
};

export type SharedCart = {
  token: string;
  domain: string;
  items: CartItem[];
  createdAt: number;
};

// Carts live in memory for fast reads, backed by a JSON file so they survive
// a server restart. This is fine for a single instance (local dev, or one
// small server) but won't work once you run more than one instance behind a
// load balancer — at that point swap this for Postgres/SQLite with a real
// connection, keeping createSharedCart/getSharedCart as the interface.
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "carts.json");

const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const carts = new Map<string, SharedCart>(loadFromDisk());

function isExpired(cart: SharedCart): boolean {
  return Date.now() - cart.createdAt > EXPIRY_MS;
}

function loadFromDisk(): [string, SharedCart][] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed: SharedCart[] = JSON.parse(raw);
    // Drop anything that expired while the server was down, so an old file
    // doesn't resurrect stale carts on the next restart.
    return parsed.filter((cart) => !isExpired(cart)).map((cart) => [cart.token, cart]);
  } catch {
    // No file yet (first run) or it's unreadable — start empty either way.
    return [];
  }
}

function persistToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(carts.values())));
  } catch (err) {
    // Persistence failing shouldn't take the request down — the cart is
    // still usable for the rest of this process's lifetime.
    console.error("Failed to persist carts to disk:", err);
  }
}

const MAX_QUANTITY = 99;
// Amazon ASINs are 10 alphanumeric characters. Rejecting anything else here
// stops garbage from ever reaching the Amazon add-to-cart URL, regardless of
// what validation (or lack of it) happened upstream in the route handler.
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;

function sanitizeItems(items: CartItem[]): CartItem[] {
  const clamped = items
    .filter((item) => ASIN_PATTERN.test(item.asin))
    .map((item) => ({
      ...item,
      quantity: Math.min(Math.max(Math.floor(item.quantity) || 1, 1), MAX_QUANTITY),
    }));

  // The extension already dedupes on its side, but the API is reachable
  // directly too — merge here so a duplicate ASIN never produces two
  // ASIN.N entries for the same product in the Amazon bulk-add URL.
  const merged = new Map<string, CartItem>();
  for (const item of clamped) {
    const existing = merged.get(item.asin);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + item.quantity, MAX_QUANTITY);
    } else {
      merged.set(item.asin, { ...item });
    }
  }

  return Array.from(merged.values());
}

export function createSharedCart(items: CartItem[], domain: string): SharedCart {
  const token = randomBytes(6).toString("base64url");
  const cart: SharedCart = { token, domain, items: sanitizeItems(items), createdAt: Date.now() };
  carts.set(token, cart);
  persistToDisk();
  return cart;
}

export function getSharedCart(token: string): SharedCart | undefined {
  const cart = carts.get(token);
  if (!cart) return undefined;

  if (isExpired(cart)) {
    carts.delete(token);
    persistToDisk();
    return undefined;
  }

  return cart;
}
