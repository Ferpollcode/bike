// Cart state — array of { code, name, price, qty }
let cart = [];

export function getCart() { return cart; }
export function clearCart() { cart = []; }

export function addToCart(product, qty = 1) {
  const existing = cart.find((item) => item.code === product.code);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ code: product.code, name: product.description, price: product.price, qty });
  }
}

export function removeFromCart(code) {
  cart = cart.filter((item) => item.code !== code);
}

export function updateCartQty(code, qty) {
  const item = cart.find((i) => i.code === code);
  if (item) item.qty = Math.max(1, qty);
}

export function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function cartItemCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

// --- Rendering helpers (called from bicifer-app.js) ---

export function renderCatalogGrid(products, searchTerm, money, escapeHtml) {
  const term = String(searchTerm || "").toLowerCase().trim();
  const filtered = term
    ? products.filter((p) =>
        `${p.code} ${p.description}`.toLowerCase().includes(term)
      )
    : products;

  if (!filtered.length) {
    return `<p class="muted" style="padding:16px 0">No se encontraron productos.</p>`;
  }

  return filtered
    .map(
      (p) => `
      <article class="product-card">
        <div class="product-card-image">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
        </div>
        <p class="product-card-name">${escapeHtml(p.description)}</p>
        <p class="product-card-code">${escapeHtml(p.code)}</p>
        <p class="product-card-price">${money(p.price)}</p>
        <div class="product-card-add">
          <button class="qty-btn" data-qty-dec="${escapeHtml(p.code)}" type="button">−</button>
          <input class="catalog-qty-input" data-qty-input="${escapeHtml(p.code)}" type="number" min="1" step="1" value="1" inputmode="numeric" />
          <button class="qty-btn" data-qty-inc="${escapeHtml(p.code)}" type="button">+</button>
        </div>
        <button class="product-card-btn" data-add-to-cart="${escapeHtml(p.code)}" type="button">Agregar</button>
      </article>
    `
    )
    .join("");
}

export function renderCartItems(money, escapeHtml) {
  if (!cart.length) {
    return `<p class="cart-empty">El carrito está vacío.</p>`;
  }
  return cart
    .map(
      (item) => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="muted" style="font-size:12px">x${item.qty}</div>
        </div>
        <span class="cart-item-subtotal">${money(item.price * item.qty)}</span>
        <button class="cart-item-remove" data-remove-cart="${escapeHtml(item.code)}" type="button">✕</button>
      </div>
    `
    )
    .join("");
}
