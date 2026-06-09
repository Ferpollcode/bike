const CART_SESSION_KEY = "bicifer-cart-v1";

function saveCartToSession() {
  try { sessionStorage.setItem(CART_SESSION_KEY, JSON.stringify(cart)); } catch {}
}

let cart = (() => {
  try {
    const saved = sessionStorage.getItem(CART_SESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
})();

export function getCart() { return cart; }

export function clearCart() {
  cart = [];
  saveCartToSession();
}

export function addToCart(product, qty = 1) {
  const existing = cart.find((item) => item.code === product.code);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ code: product.code, name: product.description, price: product.price, qty });
  }
  saveCartToSession();
}

export function removeFromCart(code) {
  cart = cart.filter((item) => item.code !== code);
  saveCartToSession();
}

export function updateCartQty(code, qty) {
  const item = cart.find((i) => i.code === code);
  if (item) {
    item.qty = Math.max(1, qty);
    saveCartToSession();
  }
}

export function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function cartItemCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

export function renderCatalogGrid(products, searchTerm, money, escapeHtml) {
  const term = String(searchTerm || "").toLowerCase().trim();
  const filtered = term
    ? products.filter((p) => `${p.code} ${p.description}`.toLowerCase().includes(term))
    : products;

  if (!filtered.length) {
    return `<p class="muted" style="padding:16px 0">No se encontraron productos.</p>`;
  }

  return filtered.map((p) => {
    const inCart = cart.find((i) => i.code === p.code);
    const cardClass = inCart ? "product-card product-card--in-cart" : "product-card";
    const btnText = inCart ? "Actualizar" : "Agregar";
    const qtyValue = inCart ? inCart.qty : 1;
    return `
      <article class="${cardClass}">
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
          <input class="catalog-qty-input" data-qty-input="${escapeHtml(p.code)}" type="number" min="1" step="1" value="${qtyValue}" inputmode="numeric" />
          <button class="qty-btn" data-qty-inc="${escapeHtml(p.code)}" type="button">+</button>
        </div>
        <button class="product-card-btn${inCart ? " product-card-btn--update" : ""}" data-add-to-cart="${escapeHtml(p.code)}" type="button">${btnText}</button>
      </article>
    `;
  }).join("");
}

export function renderCartItems(money, escapeHtml) {
  if (!cart.length) {
    return `<p class="cart-empty">El carrito está vacío.</p>`;
  }
  return cart.map((item) => `
    <div class="cart-item">
      <div class="cart-item-name">${escapeHtml(item.name)}</div>
      <button class="cart-item-remove" data-remove-cart="${escapeHtml(item.code)}" type="button">✕</button>
      <div class="cart-item-qty-row">
        <button class="cart-qty-btn" data-cart-dec="${escapeHtml(item.code)}" type="button">−</button>
        <span class="cart-item-qty">${item.qty}</span>
        <button class="cart-qty-btn" data-cart-inc="${escapeHtml(item.code)}" type="button">+</button>
      </div>
      <span class="cart-item-subtotal">${money(item.price * item.qty)}</span>
    </div>
  `).join("");
}
