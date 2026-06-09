const SESSION_KEY = "bicifer-session-v1";

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Returns "h:<hex>" — stored passwords use this prefix.
export async function hashPassword(plain) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(plain))
  );
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `h:${hex}`;
}

// Accepts both legacy plain-text passwords and hashed ones.
async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith("h:")) return stored === await hashPassword(plain);
  return stored === String(plain);
}

const OWNER_USERNAME = "pipa";
const OWNER_PASSWORD = "Pipa54321";

export async function tryLogin(username, password, state) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "").trim();
  if (!u || !p) return null;

  // Hardcoded fallback owner — change credentials in Configuración
  if (u === OWNER_USERNAME.toLowerCase() && p === OWNER_PASSWORD) {
    return { role: "owner", customerId: null };
  }

  // Configurable owner credentials
  const ownerUser = String(state.settings.ownerUsername || "").trim().toLowerCase();
  const ownerPass = String(state.settings.ownerPassword || "").trim();
  if (ownerUser && ownerPass && u === ownerUser && await verifyPassword(p, ownerPass)) {
    return { role: "owner", customerId: null };
  }

  // Customer credentials
  const customer = state.customers.find(
    (c) => String(c.username || "").trim().toLowerCase() === u
  );
  if (customer && await verifyPassword(p, customer.password)) {
    return { role: "customer", customerId: customer.id };
  }

  return null;
}

export function isOwner(session) {
  return session?.role === "owner";
}

export function isCustomer(session) {
  return session?.role === "customer";
}
