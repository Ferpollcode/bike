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

const OWNER_USERNAME = "pipa";
const OWNER_PASSWORD = "Pipa54321";

export function tryLogin(username, password, state) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "").trim();
  if (!u || !p) return null;

  // Check hardcoded owner credentials
  if (u === OWNER_USERNAME.toLowerCase() && p === OWNER_PASSWORD) {
    return { role: "owner", customerId: null };
  }

  // Check owner credentials from settings (configurable)
  const ownerUser = String(state.settings.ownerUsername || "").trim().toLowerCase();
  const ownerPass = String(state.settings.ownerPassword || "").trim();
  if (ownerUser && ownerPass && u === ownerUser && p === ownerPass) {
    return { role: "owner", customerId: null };
  }

  // Check customer credentials
  const customer = state.customers.find(
    (c) =>
      String(c.username || "").trim().toLowerCase() === u &&
      String(c.password || "").trim() === p
  );
  if (customer) {
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
