# Catálogo Ecommerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar login por roles y un módulo de catálogo con carrito que permite generar comprobantes en PDF/WhatsApp, manteniendo el sistema actual intacto para el dueño.

**Architecture:** Se crean dos módulos nuevos (`auth.js`, `catalog.js`) que se integran en `bicifer-app.js`. El HTML del login, catálogo y modal de checkout se agrega al `appMarkup` de `page.jsx`. El control de acceso por rol se aplica en `initBiciferApp` después de cargar el estado.

**Tech Stack:** Next.js App Router, vanilla JS (sin React state), Supabase (estado ya sincronizado), localStorage para sesión.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `app/auth.js` | Crear | Session management, login validation, role helpers |
| `app/catalog.js` | Crear | Catalog render, cart state, cart render, checkout trigger |
| `app/bicifer-app.js` | Modificar | Importar auth/catalog, actualizar modelo de datos, integrar en init/render/bindEvents |
| `app/page.jsx` | Modificar | Agregar HTML: pantalla login, tab catálogo, sección catálogo, modal checkout |
| `app/globals.css` | Modificar | Estilos: login screen, catalog grid, product cards, cart panel, floating button, bottom sheet |

---

## Task 1: Módulo de sesión (`app/auth.js`)

**Files:**
- Create: `app/auth.js`

- [ ] **Paso 1: Crear `app/auth.js`**

```js
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

export function tryLogin(username, password, state) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "").trim();
  if (!u || !p) return null;

  // Check owner credentials
  const ownerUser = String(state.settings.ownerUsername || "").trim().toLowerCase();
  const ownerPass = String(state.settings.ownerPassword || "").trim();
  if (u === ownerUser && p === ownerPass) {
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
```

- [ ] **Paso 2: Verificar que el archivo se creó correctamente**

Abrir `app/auth.js` y confirmar que el contenido es correcto.

- [ ] **Paso 3: Commit**

```bash
git add app/auth.js
git commit -m "feat: auth session module (login, role helpers)"
```

---

## Task 2: HTML — Login screen + tab Catálogo + sección Catálogo + modal Checkout

**Files:**
- Modify: `app/page.jsx`

- [ ] **Paso 1: Agregar la pantalla de login al inicio de `appMarkup` (antes del `<header>`)**

En `page.jsx`, al inicio del template string `appMarkup`, antes de `<header class="app-header">`, agregar:

```html
  <div id="loginScreen" class="login-screen hidden">
    <div class="login-card">
      <div class="login-logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="48" height="48" aria-hidden="true">
          <circle cx="6" cy="17" r="4"/><circle cx="18" cy="17" r="4"/>
          <path d="M6 17 L12 17 L12 10 L6 17"/>
          <line x1="12" y1="17" x2="18" y2="13"/>
          <line x1="12" y1="10" x2="18" y2="13"/>
          <line x1="10.5" y1="10" x2="13.5" y2="10"/>
          <path d="M18 13 L16.5 11.2 M18 13 L19.5 11.2"/>
          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>
        </svg>
        <h1>BIKE STORE MDZ</h1>
      </div>
      <form id="loginForm">
        <label>Usuario<input id="loginUsername" type="text" autocomplete="username" placeholder="Tu usuario" /></label>
        <label>Contraseña<input id="loginPassword" type="password" autocomplete="current-password" placeholder="Tu contraseña" /></label>
        <p id="loginError" class="login-error hidden">Usuario o contraseña incorrectos.</p>
        <button class="primary full" type="submit">Ingresar</button>
      </form>
    </div>
  </div>
```

- [ ] **Paso 2: Agregar el tab "Catálogo" en la nav y en el module menu**

En `page.jsx`, en el `<nav class="tabs">`, agregar después del último tab existente:
```html
      <button class="tab" data-view="catalogo" type="button">Catálogo</button>
```

En el `<div id="moduleMenuList">`, agregar:
```html
        <button data-module-option="catalogo" type="button">Catálogo</button>
```

- [ ] **Paso 3: Agregar botón de logout en el header**

En `page.jsx`, dentro del `<header class="app-header">`, agregar al final del header div:
```html
      <button id="logoutBtn" class="logout-btn" type="button">Salir</button>
```

- [ ] **Paso 4: Agregar la sección Catálogo**

En `page.jsx`, después de la sección `</section>` de "ajustes" y antes del cierre de `</main>`, agregar:

```html
    <section class="view" id="catalogo">
      <div class="catalog-layout">
        <div class="catalog-main">
          <input id="catalogSearch" type="search" placeholder="Buscar por nombre o codigo..." class="catalog-search" />
          <div id="catalogGrid" class="catalog-grid"></div>
        </div>
        <aside id="cartPanel" class="cart-panel">
          <h2 class="cart-title">Carrito</h2>
          <div id="cartItems" class="cart-items"></div>
          <div class="cart-footer">
            <div class="cart-total-row">
              <span>Total</span>
              <strong id="cartTotal">$0</strong>
            </div>
            <button id="checkoutBtn" class="primary full" type="button" disabled>Generar comprobante</button>
          </div>
        </aside>
      </div>
      <button id="cartFloatingBtn" class="cart-floating-btn" type="button" aria-label="Ver carrito">
        🛒 <span id="cartBadge" class="cart-badge hidden">0</span>
      </button>
      <div id="cartBottomSheet" class="cart-bottom-sheet hidden">
        <div class="cart-bottom-sheet-handle"></div>
        <h2 class="cart-title">Carrito</h2>
        <div id="cartItemsMobile" class="cart-items"></div>
        <div class="cart-footer">
          <div class="cart-total-row">
            <span>Total</span>
            <strong id="cartTotalMobile">$0</strong>
          </div>
          <button id="checkoutBtnMobile" class="primary full" type="button" disabled>Generar comprobante</button>
        </div>
      </div>
    </section>
```

- [ ] **Paso 5: Agregar el modal de checkout**

En `page.jsx`, después del `<div class="modal hidden" id="receiptModal">` existente, agregar:

```html
    <div class="modal hidden" id="checkoutModal" role="dialog" aria-modal="true">
      <div class="modal-card">
        <div class="modal-actions no-print">
          <button id="closeCheckoutModal" type="button">Cancelar</button>
        </div>
        <div class="checkout-form">
          <h2>Confirmar comprobante</h2>
          <label>Cliente<select id="checkoutCustomer"></select></label>
          <div class="grid two">
            <label>Fecha<input id="checkoutDate" type="date" /></label>
            <label>Condicion<select id="checkoutCondition">
              <option value="cuenta">Cuenta corriente</option>
              <option value="contado">Contado</option>
            </select></label>
          </div>
          <button class="primary full" id="confirmCheckout" type="button">Confirmar y generar PDF</button>
        </div>
      </div>
    </div>
```

- [ ] **Paso 6: Commit**

```bash
git add app/page.jsx
git commit -m "feat: add login screen, catalog section, checkout modal HTML"
```

---

## Task 3: Estilos — Login, Catálogo, Carrito

**Files:**
- Modify: `app/globals.css`

- [ ] **Paso 1: Agregar estilos de login screen**

Al final de `app/globals.css`, agregar:

```css
/* ---- Login ---- */
.login-screen {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 16px;
}

.login-screen.hidden {
  display: none;
}

.login-card {
  width: min(400px, 100%);
  padding: 32px 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.login-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  color: var(--primary);
}

.login-logo h1 {
  margin: 0;
  font-size: 20px;
  color: var(--text);
  text-align: center;
}

.login-error {
  margin: 0 0 10px;
  color: var(--danger);
  font-size: 14px;
  font-weight: 700;
}

.login-error.hidden {
  display: none;
}

.logout-btn {
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.12);
  color: #fff;
  white-space: nowrap;
}

.logout-btn:active {
  background: rgba(255,255,255,0.2);
}
```

- [ ] **Paso 2: Agregar estilos del catálogo**

Continuar en `app/globals.css`:

```css
/* ---- Catalog ---- */
.catalog-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  align-items: start;
}

.catalog-main {
  min-width: 0;
}

.catalog-search {
  width: 100%;
  margin-bottom: 14px;
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.product-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
  text-align: center;
}

.product-card-image {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #eef2f6;
  color: var(--muted);
}

.product-card-name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
}

.product-card-code {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}

.product-card-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
  margin: 0;
}

.product-card-add {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  gap: 4px;
  align-items: center;
  width: 100%;
  margin-top: 4px;
}

.product-card-add input {
  min-height: 36px;
  padding: 4px 6px;
  text-align: center;
  font-size: 14px;
}

.qty-btn {
  min-height: 36px;
  padding: 0;
  font-size: 16px;
  font-weight: 700;
  background: #e9eef3;
}

.product-card-btn {
  width: 100%;
  margin-top: 4px;
  padding: 9px 8px;
  font-size: 13px;
  color: #fff;
  background: var(--primary);
}

.product-card-btn:active {
  background: var(--primary-dark);
}
```

- [ ] **Paso 3: Agregar estilos del carrito (desktop + mobile)**

Continuar en `app/globals.css`:

```css
/* ---- Cart panel (desktop) ---- */
.cart-panel {
  position: sticky;
  top: 120px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cart-title {
  margin: 0;
  font-size: 18px;
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
}

.cart-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 13px;
}

.cart-item-name {
  font-weight: 700;
  line-height: 1.3;
}

.cart-item-subtotal {
  color: var(--primary);
  font-weight: 700;
  white-space: nowrap;
}

.cart-item-remove {
  padding: 4px 8px;
  font-size: 12px;
  min-height: unset;
  color: #fff;
  background: var(--danger);
}

.cart-empty {
  color: var(--muted);
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}

.cart-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 700;
  padding: 8px 0 4px;
  border-top: 1px solid var(--line);
}

.cart-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---- Cart floating button (mobile only) ---- */
.cart-floating-btn {
  display: none;
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 15;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  font-size: 22px;
  background: var(--primary);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  padding: 0;
}

.cart-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.cart-badge.hidden {
  display: none;
}

/* ---- Cart bottom sheet (mobile only) ---- */
.cart-bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
  padding: 12px 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 75vh;
  overflow-y: auto;
}

.cart-bottom-sheet.hidden {
  display: none;
}

.cart-bottom-sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--line);
  margin: 0 auto 4px;
}

/* ---- Checkout modal form ---- */
.checkout-form {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkout-form h2 {
  margin-bottom: 16px;
}

/* ---- Responsive catalog ---- */
@media (max-width: 760px) {
  .catalog-layout {
    grid-template-columns: 1fr;
  }

  .cart-panel {
    display: none;
  }

  .cart-floating-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
  }

  .catalog-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Paso 4: Agregar estilos del tab Catálogo**

En `app/globals.css`, dentro del bloque de colores de tabs (cerca de línea 264), agregar:

```css
.tab[data-view="catalogo"] {
  background: #fdf4ff;
  color: #6b21a8;
}

.tab[data-view="catalogo"].active {
  background: #7c3aed;
}
```

Y en `.module-menu-list button[data-module-option="catalogo"]`, dentro del bloque de media query correspondiente (buscar el bloque de colores del module menu, alrededor de línea 1032), agregar:

```css
  .module-menu-list button[data-module-option="catalogo"] {
    background: #fdf4ff;
    color: #6b21a8;
  }

  .mobile-module-menu[data-view="catalogo"] .module-menu-button,
  .module-menu-list button[data-module-option="catalogo"].active {
    background: #7c3aed;
    color: #fff;
  }
```

- [ ] **Paso 5: Actualizar la grilla de tabs a 8 columnas**

Buscar en `globals.css`:
```css
  grid-template-columns: repeat(7, minmax(0, 1fr));
```
Cambiar a:
```css
  grid-template-columns: repeat(8, minmax(0, 1fr));
```

- [ ] **Paso 6: Commit**

```bash
git add app/globals.css
git commit -m "feat: catalog, cart, login styles"
```

---

## Task 4: Módulo de catálogo y carrito (`app/catalog.js`)

**Files:**
- Create: `app/catalog.js`

- [ ] **Paso 1: Crear `app/catalog.js`**

```js
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
```

- [ ] **Paso 2: Commit**

```bash
git add app/catalog.js
git commit -m "feat: catalog cart module (add/remove/render)"
```

---

## Task 5: Integración en `bicifer-app.js` — modelo de datos y auth

**Files:**
- Modify: `app/bicifer-app.js`

- [ ] **Paso 1: Agregar imports al inicio de `bicifer-app.js`**

Después de la línea `import { Chart, ... } from "chart.js";`, agregar:

```js
import { loadSession, saveSession, clearSession, tryLogin, isOwner, isCustomer } from "./auth";
import {
  getCart, clearCart, addToCart, removeFromCart, updateCartQty,
  cartTotal, cartItemCount, renderCatalogGrid, renderCartItems
} from "./catalog";
```

- [ ] **Paso 2: Actualizar `defaultState` para incluir credenciales del dueño**

Cambiar `defaultState.settings` de:
```js
  settings: {
    bizName: "BIKE STORE MDZ",
    bizPhone: "",
    bizAddress: "",
    bizFooter: "Gracias por su compra.",
    nextNumber: 1
  },
```
A:
```js
  settings: {
    bizName: "BIKE STORE MDZ",
    bizPhone: "",
    bizAddress: "",
    bizFooter: "Gracias por su compra.",
    nextNumber: 1,
    ownerUsername: "",
    ownerPassword: ""
  },
```

- [ ] **Paso 3: Agregar variable de sesión**

Después de `let editingProductCode = null;`, agregar:
```js
let session = null;
```

- [ ] **Paso 4: Actualizar `moduleLabels` para incluir Catálogo**

```js
const moduleLabels = {
  venta: "Venta",
  clientes: "Clientes",
  productos: "Productos",
  cuentas: "Cuentas",
  remitos: "Comprobantes",
  ajustes: "Ajustes",
  analiticas: "Analíticas",
  catalogo: "Catálogo"
};
```

- [ ] **Paso 5: Actualizar `saveCustomer` para manejar `username` y `password`**

Cambiar la firma de `saveCustomer` de:
```js
function saveCustomer({ name, phone = "", address = "" }) {
```
A:
```js
function saveCustomer({ name, phone = "", address = "", username = "", password = "" }) {
```

En el bloque de edición, cambiar:
```js
    existing.name = name.trim();
    existing.phone = phone.trim();
    existing.address = address.trim();
```
A:
```js
    existing.name = name.trim();
    existing.phone = phone.trim();
    existing.address = address.trim();
    existing.username = username.trim();
    existing.password = password.trim();
```

En el bloque de creación, cambiar:
```js
  const customer = {
    id: uid("cli"),
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    createdAt: Date.now()
  };
```
A:
```js
  const customer = {
    id: uid("cli"),
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    username: username.trim(),
    password: password.trim(),
    createdAt: Date.now()
  };
```

- [ ] **Paso 6: Actualizar `loadCustomerForEdit` para cargar username y password**

Después de `$("#customerAddress").value = customer.address || "";`, agregar:
```js
  $("#customerUsername").value = customer.username || "";
  $("#customerPassword").value = customer.password || "";
```

- [ ] **Paso 7: Actualizar `renderSettings` para incluir credenciales del dueño**

Al final de la función `renderSettings()`, agregar:
```js
  if ($("#ownerUsername")) $("#ownerUsername").value = state.settings.ownerUsername || "";
  if ($("#ownerPassword")) $("#ownerPassword").value = state.settings.ownerPassword || "";
```

- [ ] **Paso 8: Commit**

```bash
git add app/bicifer-app.js
git commit -m "feat: update data model (owner credentials, customer username/password)"
```

---

## Task 6: Integración en `bicifer-app.js` — render del catálogo

**Files:**
- Modify: `app/bicifer-app.js`

- [ ] **Paso 1: Agregar `renderCatalog()` al final de las funciones de render**

Después de `function renderAnalytics() { ... }`, agregar:

```js
function renderCatalog() {
  const grid = $("#catalogGrid");
  if (!grid) return;
  const term = $("#catalogSearch")?.value || "";
  grid.innerHTML = renderCatalogGrid(state.products, term, money, escapeHtml);
  renderCartPanels();
}

function renderCartPanels() {
  const itemsHtml = renderCartItems(money, escapeHtml);
  const total = cartTotal();
  const count = cartItemCount();
  const hasItems = count > 0;

  const cartItemsEl = $("#cartItems");
  if (cartItemsEl) cartItemsEl.innerHTML = itemsHtml;

  const cartItemsMobileEl = $("#cartItemsMobile");
  if (cartItemsMobileEl) cartItemsMobileEl.innerHTML = itemsHtml;

  const cartTotalEl = $("#cartTotal");
  if (cartTotalEl) cartTotalEl.textContent = money(total);

  const cartTotalMobileEl = $("#cartTotalMobile");
  if (cartTotalMobileEl) cartTotalMobileEl.textContent = money(total);

  const checkoutBtn = $("#checkoutBtn");
  if (checkoutBtn) checkoutBtn.disabled = !hasItems;

  const checkoutBtnMobile = $("#checkoutBtnMobile");
  if (checkoutBtnMobile) checkoutBtnMobile.disabled = !hasItems;

  const badge = $("#cartBadge");
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("hidden", !hasItems);
  }
}
```

- [ ] **Paso 2: Registrar `renderCatalog` en la función `render()`**

Al final de `function render() { ... }`, agregar:
```js
  renderCatalog();
```

- [ ] **Paso 3: Commit**

```bash
git add app/bicifer-app.js
git commit -m "feat: catalog and cart render functions"
```

---

## Task 7: Integración en `bicifer-app.js` — eventos del catálogo y checkout

**Files:**
- Modify: `app/bicifer-app.js`

- [ ] **Paso 1: Agregar función `bindCatalogEvents()`**

Después de `function bindEvents() { ... }`, agregar:

```js
function bindCatalogEvents() {
  on("#catalogSearch", "input", renderCatalog);

  on("#catalogGrid", "click", (e) => {
    const addBtn = e.target.closest("[data-add-to-cart]");
    const decBtn = e.target.closest("[data-qty-dec]");
    const incBtn = e.target.closest("[data-qty-inc]");

    if (decBtn) {
      const input = $("#catalogGrid").querySelector(`[data-qty-input="${decBtn.dataset.qtyDec}"]`);
      if (input) input.value = Math.max(1, parseInt(input.value || "1", 10) - 1);
      return;
    }
    if (incBtn) {
      const input = $("#catalogGrid").querySelector(`[data-qty-input="${incBtn.dataset.qtyInc}"]`);
      if (input) input.value = parseInt(input.value || "1", 10) + 1;
      return;
    }
    if (addBtn) {
      const code = addBtn.dataset.addToCart;
      const product = state.products.find((p) => p.code === code);
      if (!product) return;
      const qtyInput = $("#catalogGrid").querySelector(`[data-qty-input="${code}"]`);
      const qty = Math.max(1, parseInt(qtyInput?.value || "1", 10));
      addToCart(product, qty);
      if (qtyInput) qtyInput.value = 1;
      renderCartPanels();
    }
  });

  const handleRemoveFromCart = (e) => {
    const btn = e.target.closest("[data-remove-cart]");
    if (!btn) return;
    removeFromCart(btn.dataset.removeCart);
    renderCartPanels();
  };

  on("#cartItems", "click", handleRemoveFromCart);
  on("#cartItemsMobile", "click", handleRemoveFromCart);

  on("#cartFloatingBtn", "click", () => {
    $("#cartBottomSheet")?.classList.toggle("hidden");
  });

  const openCheckout = () => {
    const modal = $("#checkoutModal");
    if (!modal) return;
    $("#checkoutDate").value = today();
    // Pre-select customer if logged in as customer
    if (isCustomer(session)) {
      $("#checkoutCustomer").value = session.customerId;
    }
    modal.classList.remove("hidden");
  };

  on("#checkoutBtn", "click", openCheckout);
  on("#checkoutBtnMobile", "click", openCheckout);

  on("#closeCheckoutModal", "click", () => {
    $("#checkoutModal")?.classList.add("hidden");
  });

  on("#confirmCheckout", "click", () => {
    const customerId = $("#checkoutCustomer").value;
    const date = $("#checkoutDate").value;
    const condition = $("#checkoutCondition").value;
    const items = getCart().map((item) => ({
      name: `${item.code} - ${item.name}`,
      qty: item.qty,
      price: item.price
    }));

    if (!customerId) { alert("Seleccioná un cliente."); return; }
    if (!items.length) { alert("El carrito está vacío."); return; }

    const receipt = buildAndSaveReceipt({ customerId, date, condition, items });
    clearCart();
    renderCartPanels();
    $("#checkoutModal")?.classList.add("hidden");
    openReceipt(receipt.id);
  });
}
```

- [ ] **Paso 2: Agregar función `buildAndSaveReceipt`**

Agregar antes de `bindCatalogEvents`:

```js
function buildAndSaveReceipt({ customerId, date, condition, items }) {
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const receipt = {
    id: uid("rem"),
    number: receiptNumber(),
    customerId,
    date: date || today(),
    condition,
    notes: "",
    items,
    total,
    createdAt: Date.now()
  };
  state.receipts.push(receipt);
  if (condition === "cuenta") {
    state.ledger.push({
      id: uid("mov"),
      customerId,
      type: "sale",
      amount: total,
      date: receipt.date,
      note: `Comprobante ${receipt.number}`,
      receiptId: receipt.id,
      createdAt: Date.now()
    });
  }
  state.settings.nextNumber += 1;
  saveState();
  render();
  return receipt;
}
```

- [ ] **Paso 3: Llamar a `bindCatalogEvents()` desde `bindEvents()`**

Al final de `function bindEvents()`, agregar:
```js
  bindCatalogEvents();
```

- [ ] **Paso 4: Commit**

```bash
git add app/bicifer-app.js
git commit -m "feat: catalog events, cart interactions, checkout flow"
```

---

## Task 8: Integración en `bicifer-app.js` — login y control de roles

**Files:**
- Modify: `app/bicifer-app.js`

- [ ] **Paso 1: Agregar función `applyRoleUI()`**

Antes de `function init()`, agregar:

```js
function applyRoleUI() {
  const ownerOnlyViews = ["venta", "clientes", "productos", "cuentas", "remitos", "ajustes", "analiticas"];
  if (isOwner(session)) {
    $$(".tab").forEach((tab) => tab.classList.remove("role-hidden"));
    $$("[data-module-option]").forEach((btn) => btn.classList.remove("role-hidden"));
  } else {
    ownerOnlyViews.forEach((view) => {
      $$(`.tab[data-view="${view}"]`).forEach((el) => el.classList.add("role-hidden"));
      $$(`[data-module-option="${view}"]`).forEach((el) => el.classList.add("role-hidden"));
    });
    switchView("catalogo");
  }
}
```

- [ ] **Paso 2: Agregar CSS para `role-hidden`**

En `app/globals.css`, agregar:
```css
.role-hidden {
  display: none !important;
}
```

- [ ] **Paso 3: Agregar `bindLoginEvents()`**

Después de `function bindCatalogEvents() { ... }`, agregar:

```js
function bindLoginEvents() {
  on("#loginForm", "submit", (e) => {
    e.preventDefault();
    const username = $("#loginUsername").value;
    const password = $("#loginPassword").value;
    const result = tryLogin(username, password, state);
    if (!result) {
      $("#loginError")?.classList.remove("hidden");
      return;
    }
    session = result;
    saveSession(session);
    showApp();
  });

  on("#logoutBtn", "click", () => {
    clearSession();
    session = null;
    clearCart();
    showLogin();
  });
}

function showLogin() {
  $("#loginScreen")?.classList.remove("hidden");
  document.querySelector(".app-header")?.classList.add("hidden");
  $("main.app-shell")?.classList.add("hidden");
}

function showApp() {
  $("#loginScreen")?.classList.add("hidden");
  document.querySelector(".app-header")?.classList.remove("hidden");
  $("main.app-shell")?.classList.remove("hidden");
  applyRoleUI();
  render();
}
```

- [ ] **Paso 4: Modificar `init()` para manejar sesión**

Cambiar `function init()` de:
```js
function init() {
  $("#saleDate").value = today();
  $("#paymentDate").value = today();
  if ($("#moduleMenuButton")) $(".mobile-module-menu")?.setAttribute("data-view", "venta");
  bindEvents();
  render();
}
```
A:
```js
function init() {
  $("#saleDate").value = today();
  if ($("#paymentDate")) $("#paymentDate").value = today();
  if ($("#moduleMenuButton")) $(".mobile-module-menu")?.setAttribute("data-view", "venta");
  bindEvents();
  bindLoginEvents();
  session = loadSession();
  if (session) {
    showApp();
  } else {
    showLogin();
  }
}
```

- [ ] **Paso 5: Agregar CSS `app-header.hidden` y `main.hidden`**

En `app/globals.css`, agregar:
```css
.app-header.hidden,
main.app-shell.hidden {
  display: none !important;
}
```

- [ ] **Paso 5b: Prevenir flash de contenido — arrancar header y main ocultos**

En `app/page.jsx`, en el `appMarkup`, cambiar:
```html
  <header class="app-header">
```
Por:
```html
  <header class="app-header hidden">
```

Y cambiar:
```html
  <main class="app-shell">
```
Por:
```html
  <main class="app-shell hidden">
```

Así el contenido de la app permanece oculto hasta que JS verifique la sesión y llame a `showApp()` o `showLogin()`.

- [ ] **Paso 6: Commit**

```bash
git add app/bicifer-app.js app/globals.css
git commit -m "feat: role-based UI, login/logout flow, session persistence"
```

---

## Task 9: HTML — campos de credenciales en Ajustes y Clientes

**Files:**
- Modify: `app/page.jsx`

- [ ] **Paso 1: Agregar campos de credenciales del dueño en Ajustes**

En `page.jsx`, dentro del `<form id="settingsForm">`, después del campo `bizFooter`, agregar:

```html
            <h3 style="margin:16px 0 8px;font-size:15px">Acceso del dueño</h3>
            <label>Usuario<input id="ownerUsername" type="text" autocomplete="off" placeholder="Usuario para ingresar" /></label>
            <label>Contraseña<input id="ownerPassword" type="password" autocomplete="off" placeholder="Contraseña" /></label>
```

- [ ] **Paso 2: Agregar campos de credenciales en el formulario de Clientes**

En `page.jsx`, dentro del `<form id="customerForm">`, después del campo `customerAddress`, agregar:

```html
            <label>Usuario (acceso catálogo)<input id="customerUsername" type="text" autocomplete="off" placeholder="Ej: cliente01" /></label>
            <label>Contraseña<input id="customerPassword" type="password" autocomplete="off" placeholder="Contraseña del cliente" /></label>
```

- [ ] **Paso 3: Actualizar el handler de `settingsForm` en `bicifer-app.js`**

Buscar el handler `on("#settingsForm", "submit", ...)` y agregar en el bloque de actualización de settings:

```js
    state.settings.ownerUsername = $("#ownerUsername")?.value.trim() || state.settings.ownerUsername;
    state.settings.ownerPassword = $("#ownerPassword")?.value.trim() || state.settings.ownerPassword;
```

- [ ] **Paso 4: Actualizar el handler de `customerForm` en `bicifer-app.js`**

Buscar el handler `on("#customerForm", "submit", ...)` y agregar `username` y `password` al llamado de `saveCustomer`:

```js
      saveCustomer({
        name: $("#customerName").value,
        phone: $("#customerPhone").value,
        address: $("#customerAddress").value,
        username: $("#customerUsername")?.value || "",
        password: $("#customerPassword")?.value || ""
      });
      event.target.reset();
      $("#customerPhone").value = "549";
```

- [ ] **Paso 5: Agregar `checkoutCustomer` a `renderSelects()`**

En la función `renderSelects()`, después de las líneas que setean `saleCustomer` y `accountCustomer`, agregar:

```js
  const checkoutCustomerEl = $("#checkoutCustomer");
  if (checkoutCustomerEl) {
    const selectedCheckout = checkoutCustomerEl.value;
    checkoutCustomerEl.innerHTML = empty + options;
    checkoutCustomerEl.value = selectedCheckout;
  }
```

- [ ] **Paso 6: Commit**

```bash
git add app/page.jsx app/bicifer-app.js
git commit -m "feat: owner/customer credential fields in settings and clients"
```

---

## Task 10: Verificación manual y push

- [ ] **Paso 1: Levantar el servidor de desarrollo**

```bash
npm run dev
```

- [ ] **Paso 2: Verificar flujo de login**

1. Abrir `http://localhost:3000`
2. Verificar que aparece la pantalla de login (sin ver el app)
3. Ir a Ajustes → cargar usuario y contraseña del dueño → Guardar
4. Recargar → ingresar con las credenciales → verificar que se ve el sistema completo con el tab "Catálogo"
5. Cerrar sesión → verificar que vuelve al login
6. Crear un cliente con usuario y contraseña → ingresar con esas credenciales → verificar que solo ve "Catálogo"

- [ ] **Paso 3: Verificar catálogo y carrito**

1. Logueado como dueño, ir a "Catálogo"
2. Verificar que se ven los productos en grilla
3. Usar el buscador — verificar que filtra
4. Cambiar cantidad y click "Agregar" — verificar que aparece en el carrito (desktop)
5. Verificar que el total se actualiza
6. Eliminar un ítem del carrito
7. Click "Generar comprobante" → verificar que abre el modal con cliente, fecha y condición
8. Confirmar → verificar que genera el PDF y el comprobante queda en la lista de Comprobantes

- [ ] **Paso 4: Verificar mobile**

1. Abrir DevTools → modo mobile (375px)
2. Verificar que el carrito desktop se oculta
3. Verificar que aparece el botón flotante con badge al agregar productos
4. Tocar el botón flotante → verificar que abre el bottom sheet
5. Completar el checkout desde el bottom sheet

- [ ] **Paso 5: Push de la rama**

```bash
git push origin feature/catalogo-ecommerce
```
