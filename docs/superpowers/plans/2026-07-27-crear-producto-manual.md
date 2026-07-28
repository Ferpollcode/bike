# Crear Producto Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner create a single product by hand from the Productos panel, instead of only via bulk Excel import.

**Architecture:** Reuse the existing `#productEditPanel`/`saveProductEdit` in a new "create" mode, gated on `editingProductCode` being `null`.

**Tech Stack:** Vanilla JS DOM (`app/bicifer-app.js`), Next.js static shell (`app/page.jsx`).

## Global Constraints

- No test framework in this repo. Verification is `npx eslint <files>` and `npm run build`.
- Work happens in the existing isolated worktree (`worktree-producto-modal-foto`). Commit locally inside this worktree only — nothing pushed or merged until the user asks.
- New products start with `photoUrl: null` and `longDescription: ""` — photo/long description are added afterward via the existing edit flow, not at creation.

---

### Task 1: Manual product creation

**Files:**
- Modify: `app/page.jsx` (Productos section-title, around line 179-183)
- Modify: `app/bicifer-app.js` (`loadProductForEdit` around line 1577-1596, `saveProductEdit` around line 1598-1623, plus wiring in `init()`/`bindEvents()` near the other `#cancelProductEdit`/`#productEditForm` bindings)

**Interfaces:**
- Produces: `openNewProductForm()` — no other task depends on it, this is a self-contained feature.

- [ ] **Step 1: Add the button**

In `app/page.jsx`, replace:
```jsx
      <div class="panel">
        <div class="section-title">
          <h2>Productos</h2>
          <button id="clearProducts" type="button" class="danger-btn">Vaciar</button>
        </div>
```
with:
```jsx
      <div class="panel">
        <div class="section-title">
          <h2>Productos</h2>
          <div class="inline-actions">
            <button id="newProduct" type="button" class="primary">+ Nuevo producto</button>
            <button id="clearProducts" type="button" class="danger-btn">Vaciar</button>
          </div>
        </div>
```
(`.inline-actions` already exists as a CSS class in this codebase — used elsewhere for button rows, e.g. the product-import preview actions. No new CSS needed.)

- [ ] **Step 2: Add `openNewProductForm()` and fix up `loadProductForEdit`**

In `app/bicifer-app.js`, add this function right before `function loadProductForEdit(code) {`:
```js
function openNewProductForm() {
  editingProductCode = null;
  $("#productEditForm").reset();
  renderProductPhotoPreview(null);
  $("#productEditPanel h2").textContent = "Nuevo producto";
  $("#productEditForm button[type='submit']").textContent = "Crear producto";
  $("#productEditPanel").classList.remove("hidden");
  $("#productEditPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}
```

Then, in `loadProductForEdit`, add these two lines right after `editingProductCode = product.code;`:
```js
  $("#productEditPanel h2").textContent = "Editar producto";
  $("#productEditForm button[type='submit']").textContent = "Guardar cambios";
```
(This restores the panel's labels in case it was last left in "create" mode — `openNewProductForm` and `loadProductForEdit` must always agree on which mode is currently showing.)

- [ ] **Step 3: Branch `saveProductEdit` on create vs edit**

Replace the current `saveProductEdit` function body:
```js
function saveProductEdit(event) {
  event.preventDefault();
  const newCode = normalizeCode($("#editProductCode").value);
  const newDesc = $("#editProductDescription").value.trim();
  const newPrice = integerValue($("#editProductPrice").value);
  if (!newCode || !newDesc) {
    alert("El codigo y la descripcion son obligatorios.");
    return;
  }
  const idx = state.products.findIndex((p) => normalizeCode(p.code) === normalizeCode(editingProductCode));
  if (idx < 0) return;
  const codeChanged = newCode !== normalizeCode(editingProductCode);
  if (codeChanged && state.products.some((p, i) => i !== idx && normalizeCode(p.code) === newCode)) {
    alert(`Ya existe un producto con el codigo ${newCode}.`);
    return;
  }
  const newCategory = ($("#editProductCategory")?.value || "").trim();
  const newLongDescription = $("#editProductLongDescription").value.trim();
  state.products[idx] = { ...state.products[idx], code: newCode, description: newDesc, price: newPrice, category: newCategory, longDescription: newLongDescription, updatedAt: Date.now() };
  unmarkDeleted("products", newCode);
  sanitizeCartAgainstProducts(state.products);
  editingProductCode = null;
  $("#productEditPanel").classList.add("hidden");
  saveState();
  render();
}
```
with:
```js
function saveProductEdit(event) {
  event.preventDefault();
  const newCode = normalizeCode($("#editProductCode").value);
  const newDesc = $("#editProductDescription").value.trim();
  const newPrice = integerValue($("#editProductPrice").value);
  if (!newCode || !newDesc) {
    alert("El codigo y la descripcion son obligatorios.");
    return;
  }
  const newCategory = ($("#editProductCategory")?.value || "").trim();
  const newLongDescription = $("#editProductLongDescription").value.trim();

  if (!editingProductCode) {
    if (state.products.some((p) => normalizeCode(p.code) === newCode)) {
      alert(`Ya existe un producto con el codigo ${newCode}.`);
      return;
    }
    state.products.push({
      code: newCode,
      description: newDesc,
      price: newPrice,
      category: newCategory,
      longDescription: newLongDescription,
      photoUrl: null,
      updatedAt: Date.now()
    });
    unmarkDeleted("products", newCode);
    $("#productEditPanel").classList.add("hidden");
    saveState();
    render();
    return;
  }

  const idx = state.products.findIndex((p) => normalizeCode(p.code) === normalizeCode(editingProductCode));
  if (idx < 0) return;
  const codeChanged = newCode !== normalizeCode(editingProductCode);
  if (codeChanged && state.products.some((p, i) => i !== idx && normalizeCode(p.code) === newCode)) {
    alert(`Ya existe un producto con el codigo ${newCode}.`);
    return;
  }
  state.products[idx] = { ...state.products[idx], code: newCode, description: newDesc, price: newPrice, category: newCategory, longDescription: newLongDescription, updatedAt: Date.now() };
  unmarkDeleted("products", newCode);
  sanitizeCartAgainstProducts(state.products);
  editingProductCode = null;
  $("#productEditPanel").classList.add("hidden");
  saveState();
  render();
}
```
(The edit path below the new `if (!editingProductCode) { ... return; }` block is otherwise byte-for-byte the same as before — only the duplicated `newCategory`/`newLongDescription` reads were hoisted above the branch so both paths can use them.)

- [ ] **Step 4: Wire the button**

In `app/bicifer-app.js`, in the setup routine that already binds `#cancelProductEdit` (search for `on("#cancelProductEdit"`), add right before or after it:
```js
  on("#newProduct", "click", openNewProductForm);
```

- [ ] **Step 5: Lint and build**

Run: `npx eslint app/bicifer-app.js app/page.jsx`
Expected: clean.

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 6: Manual verification**

With `npm run dev` running, log in as owner, go to Productos:
1. Click "+ Nuevo producto" — panel opens empty, titled "Nuevo producto", button says "Crear producto".
2. Fill in a test code/name/price, submit — product appears in the list, panel closes.
3. Click "+ Nuevo producto" again, use the SAME code as an existing product, submit — confirm the "Ya existe un producto con el código X" alert, panel stays open.
4. Click "Editar" on any existing product — panel now says "Editar producto" / "Guardar cambios" again (confirms the mode labels reset correctly).
