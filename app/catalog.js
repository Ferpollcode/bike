const CART_KEY_BASE = "bicifer-cart-v1";
let cartKey = CART_KEY_BASE;

function saveCartToSession() {
  try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {}
}

let cart = (() => {
  try {
    const saved = localStorage.getItem(cartKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
})();

// Call after login to scope the cart to the customer and seed from server data.
// serverItems (from state.carts[customerId]) take precedence when non-empty.
export function initCartForCustomer(customerId, serverItems) {
  cartKey = customerId ? `${CART_KEY_BASE}:${customerId}` : CART_KEY_BASE;
  if (Array.isArray(serverItems) && serverItems.length > 0) {
    cart = serverItems;
    saveCartToSession();
    return;
  }
  try {
    const saved = localStorage.getItem(cartKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) { cart = parsed; return; }
    }
  } catch {}
  cart = [];
}

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

// Removes items whose product was deleted or marked inactive; refreshes prices to current catalog values.
export function sanitizeCartAgainstProducts(products) {
  const activeProducts = (products || []).filter((p) => p.active !== false);
  const productMap = new Map(activeProducts.map((p) => [p.code, p]));
  const before = cart.length;
  cart = cart.filter((item) => productMap.has(item.code));
  cart.forEach((item) => {
    const product = productMap.get(item.code);
    if (product) item.price = product.price;
  });
  if (cart.length !== before || products.length) saveCartToSession();
}

// Receives already-filtered, sorted and paginated products
export function renderCatalogGrid(products, money, escapeHtml) {
  if (!products.length) {
    return `<p class="muted catalog-empty">No se encontraron productos.</p>`;
  }
  return products.map((p) => {
    const inCart = cart.find((i) => i.code === p.code);
    const cardClass = inCart ? "product-card product-card--in-cart" : "product-card";
    const btnText = inCart ? "Actualizar" : "Agregar";
    const qtyValue = inCart ? inCart.qty : 1;
    const categoryBadge = p.category
      ? `<span class="product-card-category">${escapeHtml(p.category)}</span>`
      : "";
    const photoBlock = p.photoUrl
      ? `<img class="product-card-photo" loading="lazy" src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.description)}" />`
      : `
        <div class="product-card-image">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
        </div>
      `;
    return `
      <article class="${cardClass}" data-open-product="${escapeHtml(p.code)}">
        ${photoBlock}
        ${categoryBadge}
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

export function renderProductModal(product, money, escapeHtml) {
  const inCart = cart.find((i) => i.code === product.code);
  const btnText = inCart ? "Actualizar" : "Agregar";
  const qtyValue = inCart ? inCart.qty : 1;
  const photoBlock = product.photoUrl
    ? `<img class="product-modal-photo" src="${escapeHtml(product.photoUrl)}" alt="${escapeHtml(product.description)}" />`
    : `
      <div class="product-modal-photo-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
      </div>
    `;
  const descriptionBlock = product.longDescription
    ? `<p class="product-modal-description">${escapeHtml(product.longDescription)}</p>`
    : "";
  return `
    ${photoBlock}
    <h2>${escapeHtml(product.description)}</h2>
    <p class="product-card-price">${money(product.price)}</p>
    ${descriptionBlock}
    <div class="product-card-add">
      <button class="qty-btn" data-qty-dec="${escapeHtml(product.code)}" type="button">−</button>
      <input class="catalog-qty-input" data-qty-input="${escapeHtml(product.code)}" type="number" min="1" step="1" value="${qtyValue}" inputmode="numeric" />
      <button class="qty-btn" data-qty-inc="${escapeHtml(product.code)}" type="button">+</button>
    </div>
    <button class="product-card-btn${inCart ? " product-card-btn--update" : ""}" data-add-to-cart="${escapeHtml(product.code)}" type="button">${btnText}</button>
  `;
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

export function renderCategoryChips(categories, activeCategory, escapeHtml) {
  if (!categories.length) return "";
  const allActive = !activeCategory;
  const chips = [
    `<button class="category-chip${allActive ? " active" : ""}" data-category="" type="button">Todos</button>`,
    ...categories.map((cat) =>
      `<button class="category-chip${activeCategory === cat ? " active" : ""}" data-category="${escapeHtml(cat)}" type="button">${escapeHtml(cat)}</button>`
    )
  ];
  return chips.join("");
}

export function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return "";

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const prevDisabled = currentPage === 1 ? "disabled" : "";
  const nextDisabled = currentPage === totalPages ? "disabled" : "";

  const pageButtons = pages.map((page) =>
    page === "…"
      ? `<span class="page-ellipsis">…</span>`
      : `<button class="page-btn${page === currentPage ? " active" : ""}" data-page="${page}" type="button">${page}</button>`
  ).join("");

  return `
    <div class="pagination-inner">
      <button class="page-btn page-nav" data-page="${currentPage - 1}" ${prevDisabled} type="button">‹</button>
      ${pageButtons}
      <button class="page-btn page-nav" data-page="${currentPage + 1}" ${nextDisabled} type="button">›</button>
    </div>
  `;
}
