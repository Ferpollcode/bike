# Modal de Producto con Foto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the shop owner upload a photo and an optional long description per product, and let customers tap a catalog card to see the photo bigger, the title, price, and description in a modal.

**Architecture:** Two new optional fields on the product record (`photoUrl`, `longDescription`) that ride along with the existing merge/sync logic unchanged. Photos upload directly from the browser to a public Supabase Storage bucket using the same `supabase-js` client already in use — no new server routes. The catalog grid and a new product modal share one click-handling helper so "add to cart" / qty controls behave identically in both places.

**Tech Stack:** Vanilla JS DOM manipulation (`app/bicifer-app.js`, `app/catalog.js`), Next.js static shell (`app/page.jsx`), plain CSS (`app/globals.css`), `@supabase/supabase-js` (already a dependency), Supabase Storage (SQL-provisioned bucket + RLS policies in `supabase/schema.sql`).

## Global Constraints

- No test framework exists in this repo (only ESLint). Verification per task is `npx eslint <files>`, `npm run build`, and — where the logic is a pure function — a throwaway Node script deleted after it passes (see prior art: the merge-logic verification done for the sync fix). UI-only tasks are verified by manual steps against `npm run dev`.
- Do not touch real production data. Any manual browser verification against the live Supabase project must use a disposable test product, never an existing catalog item.
- Max photo size: 5 MB, enforced client-side before upload.
- Field name is `longDescription`, never `description` — `description` already means the product's short title everywhere in this codebase (`p.description` in cards, receipts, imports). Reusing it for the new long-form text would silently corrupt product titles.
- Re-importing the product Excel must never erase `photoUrl` or `longDescription` on existing products — the Excel format never carries them, so the existing record's values must be preserved exactly like `category` already is.
- Work happens in an isolated worktree on its own branch (`worktree-producto-modal-foto`). Each task ends with a normal local commit **inside this worktree only** — that's required for task review diffs and the ledger. Nothing gets pushed, merged, or applied to the user's real branch (`feature/catalogo-ecommerce`) until the user explicitly asks for that at the end.

---

### Task 1: Supabase Storage bucket and policies

**Files:**
- Modify: `supabase/schema.sql` (append)

**Interfaces:**
- Produces: a public bucket named `product-photos` that `anon` can select/insert/update/delete objects in — the trust model already used for `app_state`.

- [ ] **Step 1: Append the bucket + policy SQL**

Add to the end of `supabase/schema.sql`:

```sql
-- Product photos: public bucket, same anon-write trust model as app_state.
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read product photos" on storage.objects;
create policy "Public read product photos"
on storage.objects for select
to public
using (bucket_id = 'product-photos');

drop policy if exists "Anon upload product photos" on storage.objects;
create policy "Anon upload product photos"
on storage.objects for insert
to anon
with check (bucket_id = 'product-photos');

drop policy if exists "Anon update product photos" on storage.objects;
create policy "Anon update product photos"
on storage.objects for update
to anon
using (bucket_id = 'product-photos')
with check (bucket_id = 'product-photos');

drop policy if exists "Anon delete product photos" on storage.objects;
create policy "Anon delete product photos"
on storage.objects for delete
to anon
using (bucket_id = 'product-photos');
```

- [ ] **Step 2: Hand off to the user to run it**

This can't be verified by the implementer directly (no DB access from the coding session). Tell the user: "Corré el bloque nuevo de `supabase/schema.sql` en el SQL Editor de Supabase, y confirmame cuando el bucket `product-photos` aparezca en Storage." Do not proceed to Task 3 (upload wiring) manual verification until this is confirmed — Tasks 2 and 4-6 don't need it (pure logic / markup / other data paths), but Task 3's and Task 7's manual checks do.

---

### Task 2: Photo path helpers (pure logic)

**Files:**
- Modify: `app/bicifer-app.js` (near the other small pure helpers, e.g. next to `normalizeCode` around line 377)

**Interfaces:**
- Produces: `PRODUCT_PHOTOS_BUCKET` (const string `"product-photos"`), `productPhotoPath(code, fileName)` → string, `productPhotoPathFromUrl(url)` → string | null. Task 3 (`uploadProductPhoto`/`deleteProductPhoto`) consumes both.

- [ ] **Step 1: Add the constant and the two pure helpers**

In `app/bicifer-app.js`, near the top-level consts (after `SUPABASE_ROW_ID`):

```js
const PRODUCT_PHOTOS_BUCKET = "product-photos";
```

Near `normalizeCode`/`normalizeDesc` (around line 377-383):

```js
function productPhotoPath(code, fileName) {
  const ext = (String(fileName || "").split(".").pop() || "jpg").toLowerCase();
  return `${normalizeCode(code)}.${ext}`;
}

function productPhotoPathFromUrl(url) {
  if (!url) return null;
  const marker = `/object/public/${PRODUCT_PHOTOS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length);
}
```

- [ ] **Step 2: Write a throwaway verification script**

Create `_photo_path_test.mjs` at the repo root:

```js
function productPhotoPath(code, fileName) {
  const ext = (String(fileName || "").split(".").pop() || "jpg").toLowerCase();
  return `${String(code || "").trim().toUpperCase()}.${ext}`;
}

function productPhotoPathFromUrl(url) {
  if (!url) return null;
  const marker = "/object/public/product-photos/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length);
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK: " + msg);
}

assert(productPhotoPath("fer001", "foto.JPG") === "FER001.jpg", "path normalizes code and lowercases extension");
assert(productPhotoPath("bic010", "sin-extension") === "BIC010.sin-extension", "path falls back to whole filename when there's no dot");

const url = "https://abcxyz.supabase.co/storage/v1/object/public/product-photos/FER001.jpg";
assert(productPhotoPathFromUrl(url) === "FER001.jpg", "extracts storage path from a public URL");
assert(productPhotoPathFromUrl("https://example.com/other.jpg") === null, "returns null for a URL from a different bucket");
assert(productPhotoPathFromUrl(null) === null, "returns null for no URL");

console.log("\nAll photo path checks passed.");
```

- [ ] **Step 3: Run it and delete it**

Run: `node _photo_path_test.mjs`
Expected: all six `OK:` lines print, then "All photo path checks passed."

Then delete the throwaway script: `rm _photo_path_test.mjs` (it's verification scaffolding, not part of the app).

- [ ] **Step 4: Lint**

Run: `npx eslint app/bicifer-app.js`
Expected: no output (clean).

---

### Task 3: Upload/delete functions + wiring into the product edit panel

**Files:**
- Modify: `app/bicifer-app.js` (upload/delete functions near `saveProductEdit`/`deleteProduct`, around line 1373-1410; event wiring near the other `on(...)` calls in `init()`, around line 1670)
- Modify: `app/page.jsx` (`#productEditForm`, around line 163-174)
- Modify: `app/globals.css` (preview thumbnail style)

**Interfaces:**
- Consumes: `PRODUCT_PHOTOS_BUCKET`, `productPhotoPath`, `productPhotoPathFromUrl` (Task 2); `supabase` client, `state`, `saveState`, `render`, `editingProductCode` (existing module state).
- Produces: `uploadProductPhoto(code, file)` → `Promise<string | null>` (resolves to the public URL, or `null` on failure/oversize — already alerts the user on failure), `deleteProductPhoto(photoUrl)` → `Promise<void>` (best-effort, never throws; also called from `deleteProduct` within this same task, Step 6), `renderProductPhotoPreview(url)` (DOM-only, sets/hides `#productPhotoPreview`).

- [ ] **Step 1: Add the upload/delete functions**

In `app/bicifer-app.js`, near `saveProductEdit` (before it, so it's defined before use):

```js
const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;

async function uploadProductPhoto(code, file) {
  if (!supabase) {
    alert("No se pudo conectar con el almacenamiento de fotos.");
    return null;
  }
  if (file.size > MAX_PRODUCT_PHOTO_BYTES) {
    alert("La foto no puede pesar más de 5 MB.");
    return null;
  }
  const path = productPhotoPath(code, file.name);
  try {
    const { error } = await supabase.storage
      .from(PRODUCT_PHOTOS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (error) {
      console.warn("No se pudo subir la foto.", error);
      alert("No se pudo subir la foto. Probá de nuevo.");
      return null;
    }
    const { data } = supabase.storage.from(PRODUCT_PHOTOS_BUCKET).getPublicUrl(path);
    return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
  } catch (error) {
    console.warn("No se pudo subir la foto.", error);
    alert("No se pudo subir la foto. Probá de nuevo.");
    return null;
  }
}

async function deleteProductPhoto(photoUrl) {
  if (!supabase || !photoUrl) return;
  const path = productPhotoPathFromUrl(photoUrl);
  if (!path) return;
  try {
    await supabase.storage.from(PRODUCT_PHOTOS_BUCKET).remove([path]);
  } catch (error) {
    console.warn("No se pudo borrar la foto anterior.", error);
  }
}

function renderProductPhotoPreview(url) {
  const preview = $("#productPhotoPreview");
  if (!preview) return;
  if (url) {
    preview.src = url;
    preview.classList.remove("hidden");
  } else {
    preview.src = "";
    preview.classList.add("hidden");
  }
}
```

Note the `?v=${Date.now()}` cache-busting suffix on the returned URL: re-uploading a photo for the same product reuses the same storage path (`upsert: true`), so without a changing query string the browser (and other devices, after merge) would keep showing a cached copy of the old photo.

- [ ] **Step 2: Add the HTML fields to the edit panel**

In `app/page.jsx`, inside `#productEditForm` (around line 168-172), between the Categoría label and the submit button:

```jsx
          <label>Categoría
            <input id="editProductCategory" type="text" list="categoryOptions" placeholder="Ej: Bicicletas" />
            <datalist id="categoryOptions"></datalist>
          </label>
          <label>Descripción larga (opcional)<textarea id="editProductLongDescription" rows="3"></textarea></label>
          <label class="file-button">Subir foto<input id="editProductPhoto" type="file" accept="image/*" /></label>
          <img id="productPhotoPreview" class="product-photo-preview hidden" alt="Vista previa de la foto" />
          <button class="primary full" type="submit">Guardar cambios</button>
```

- [ ] **Step 3: Add the preview thumbnail style**

In `app/globals.css`, near `.file-button` (around line 567, right after its closing brace):

```css
.product-photo-preview {
  width: 100%;
  max-width: 200px;
  border-radius: 8px;
  margin: 4px 0 10px;
  display: block;
}

.product-photo-preview.hidden {
  display: none;
}
```

- [ ] **Step 4: Wire the file input's change event**

In `app/bicifer-app.js`, inside `init()`, near the other product-related `on(...)` calls (right after the `on("#editProductForm"...)`/`saveProductEdit` wiring — search for where `productEditForm` submit is bound):

```js
  on("#editProductPhoto", "change", async (event) => {
    const file = event.target.files[0];
    if (!file || !editingProductCode) {
      event.target.value = "";
      return;
    }
    const url = await uploadProductPhoto(editingProductCode, file);
    event.target.value = "";
    if (!url) return;
    const idx = state.products.findIndex((p) => normalizeCode(p.code) === normalizeCode(editingProductCode));
    if (idx < 0) return;
    state.products[idx] = { ...state.products[idx], photoUrl: url, updatedAt: Date.now() };
    saveState();
    renderProductPhotoPreview(url);
    render();
  });
```

- [ ] **Step 5: Populate the new fields when opening the edit panel, and save the description**

In `loadProductForEdit` (around line 1354-1371), after the existing field assignments and before `$("#productEditPanel").classList.remove("hidden")`:

```js
  $("#editProductLongDescription").value = product.longDescription || "";
  renderProductPhotoPreview(product.photoUrl || null);
```

In `saveProductEdit` (around line 1538-1540), replace:

```js
  const newCategory = ($("#editProductCategory")?.value || "").trim();
  state.products[idx] = { ...state.products[idx], code: newCode, description: newDesc, price: newPrice, category: newCategory, updatedAt: Date.now() };
  unmarkDeleted("products", newCode);
```

with:

```js
  const newCategory = ($("#editProductCategory")?.value || "").trim();
  const newLongDescription = $("#editProductLongDescription").value.trim();
  state.products[idx] = { ...state.products[idx], code: newCode, description: newDesc, price: newPrice, category: newCategory, longDescription: newLongDescription, updatedAt: Date.now() };
  unmarkDeleted("products", newCode);
```

(Same fields as before, plus reading and saving `longDescription`; the `unmarkDeleted` line is unchanged, just shown here for exact placement.)

- [ ] **Step 6: Best-effort photo cleanup when a product is deleted**

In `deleteProduct` (search for `function deleteProduct`), add a call to `deleteProductPhoto` right after the tombstone line:

```js
function deleteProduct(code) {
  const product = state.products.find((p) => normalizeCode(p.code) === normalizeCode(code));
  if (!product) return;
  if (!confirm(`¿Borrar "${product.description}"?`)) return;
  state.products = state.products.filter((p) => normalizeCode(p.code) !== normalizeCode(code));
  markDeleted("products", normalizeCode(code));
  deleteProductPhoto(product.photoUrl);
  sanitizeCartAgainstProducts(state.products);
  if (editingProductCode && normalizeCode(editingProductCode) === normalizeCode(code)) {
    editingProductCode = null;
    $("#productEditPanel").classList.add("hidden");
  }
  saveState();
  render();
}
```

`deleteProductPhoto` is not awaited here on purpose — per the spec, a failed cleanup must never block the product deletion itself; it already swallows its own errors (Step 1).

- [ ] **Step 7: Lint and build**

Run: `npx eslint app/bicifer-app.js app/page.jsx`
Expected: clean.

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 8: Manual verification (requires Task 1 done)**

With `npm run dev` running, log in as owner, go to Productos, edit any **test** product (not a real catalog item):
1. Type something in "Descripción larga", save, reopen the edit panel — confirm the text persisted.
2. Choose a small image file in "Subir foto" — confirm a preview thumbnail appears within a couple seconds.
3. In the Supabase dashboard → Storage → `product-photos`, confirm the file exists under the product's code.
4. Reload the page, reopen the same product's edit panel — confirm the preview still shows the uploaded photo (i.e. `photoUrl` persisted through `saveState`/reload).

---

### Task 4: Excel import — `descripcion_larga` column, and fix the photo/description wipe-on-reimport bug

**Files:**
- Modify: `app/bicifer-app.js` (`parseProductsFromRows` around line 385-450, `confirmProductImport` around line 1328-1338)
- Modify: `app/page.jsx` (sample-format hint, around line 136-142)

**Interfaces:**
- Consumes: `findColumn`, `normalizeHeader` (existing).
- Produces: parsed product rows now optionally carry `longDescription`; `confirmProductImport` preserves `photoUrl` and `longDescription` from the existing record when the import doesn't bring them.

- [ ] **Step 1: Read the new column in `parseProductsFromRows`**

In `app/bicifer-app.js`, after the existing `categoryIndex` line (around line 404):

```js
  const longDescriptionIndex = findColumn(headers, ["descripcion_larga", "descripcion larga"]);
```

After the existing `const category = ...` line (around line 445), add:

```js
    const longDescription = longDescriptionIndex >= 0 ? String(row[longDescriptionIndex] || "").trim() : "";
```

And update the `products.push` call right after it to include it:

```js
    products.push({ code, description, price: price ?? 0, category, longDescription });
```

- [ ] **Step 2: Fix `confirmProductImport` to preserve `photoUrl` and `longDescription`**

Replace the merge block in `confirmProductImport` (around line 1328-1338):

```js
  const byCode = new Map(state.products.map((product) => [normalizeCode(product.code), product]));
  imported.forEach((product) => {
    const code = normalizeCode(product.code);
    const existing = byCode.get(code);
    const category = product.category || existing?.category || "";
    const longDescription = product.longDescription || existing?.longDescription || "";
    byCode.set(code, {
      ...existing,
      ...product,
      category,
      longDescription,
      photoUrl: existing?.photoUrl || null,
      updatedAt: Date.now()
    });
    unmarkDeleted("products", code);
  });
```

This replaces the current version (which only preserved `category` and otherwise rebuilt the record from the Excel row alone — silently wiping `photoUrl`/`longDescription` on every re-import once those fields exist).

- [ ] **Step 3: Update the sample-format hint**

In `app/page.jsx` (around line 136-142):

```jsx
        <p class="muted">Cargar una planilla de Excel .xlsx. Encabezados requeridos: codigo, producto, precio. Las columnas categoria y descripcion_larga son opcionales.</p>
        <p class="muted">Si volves a importar la lista, los productos con el mismo codigo se actualizan (la foto y la descripcion larga cargadas a mano no se pierden). Si un nombre ya existe con otro codigo, se avisa antes de confirmar.</p>
        <div class="sample-format">
          <code>codigo | producto | precio | categoria | descripcion_larga</code>
          <code>FER001 | Martillo cabo madera | 4500 | Ferretería | Martillo de acero forjado, cabo de madera de fresno.</code>
          <code>BIC010 | Camara rodado 29 | 3800 | Bicicletas | </code>
        </div>
```

- [ ] **Step 4: Lint and build**

Run: `npx eslint app/bicifer-app.js app/page.jsx`
Expected: clean.

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 5: Manual verification**

With `npm run dev` running, log in as owner, go to Productos:
1. Import a small test `.xlsx` with the new `descripcion_larga` column for a **test** product code — confirm after import the product's long description shows up when editing it.
2. Edit that same test product, upload a photo (per Task 3), save.
3. Re-import the **same** Excel file again (same code, no photo/description column change) — open the product's edit panel afterward and confirm the photo preview and long description are both still there (this is the bug this task fixes — verify it doesn't regress).

---

### Task 5: Product modal markup and styling

**Files:**
- Modify: `app/page.jsx` (add modal markup after `#checkoutModal`, around line 405)
- Modify: `app/globals.css` (modal body layout, big photo, card photo)

**Interfaces:**
- Produces: `#productModal`, `#productModalBody` DOM elements and `.product-card-photo` / `.product-modal-photo` / `.product-modal-photo-placeholder` classes that Task 6 fills and toggles.

- [ ] **Step 1: Add the modal markup**

In `app/page.jsx`, right after the `</div>` that closes `#checkoutModal` (around line 405):

```jsx
    <div class="modal hidden" id="productModal" role="dialog" aria-modal="true">
      <div class="modal-card">
        <div class="modal-actions no-print">
          <button id="closeProductModal" type="button" data-close-product-modal>Cerrar</button>
        </div>
        <div class="product-modal-body" id="productModalBody"></div>
      </div>
    </div>
```

- [ ] **Step 2: Add the CSS**

In `app/globals.css`, near `.product-card-image` (around line 1364, after its closing brace):

```css
.product-card-photo {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
}

.product-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
}

.product-modal-photo {
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  object-fit: cover;
}

.product-modal-photo-placeholder {
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #eef2f6;
  color: var(--muted);
}

.product-modal-description {
  font-size: 14px;
  color: var(--text);
  text-align: left;
  white-space: pre-wrap;
}
```

- [ ] **Step 3: Lint and build**

Run: `npx eslint app/page.jsx`
Expected: clean (CSS isn't linted by this command, but confirms the JSX is still valid).

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Manual visual check**

With `npm run dev` running, open devtools on any page, run in the console: `document.getElementById('productModal').classList.remove('hidden')`. Confirm the empty modal overlay renders correctly (centered card, close button visible, no layout breakage), then reload the page (this is just a throwaway visual check, not a state change).

---

### Task 6: Wire the modal — open on card click, shared cart controls, close behaviors

**Files:**
- Modify: `app/catalog.js` (`renderCatalogGrid` around line 89-122; new export `renderProductModal`)
- Modify: `app/bicifer-app.js` (extract shared click handler; new `openProductModal`/`closeProductModal`; wire `#catalogGrid` and `#productModal` clicks and Escape key, around line 2191-2219 and in `init()`)

**Interfaces:**
- Consumes: `renderProductModal` (new, from `catalog.js`), `getCart`, `addToCart` (existing, from `catalog.js`), `state.products`, `money`, `escapeHtml` (existing, from `bicifer-app.js`).
- Produces: `openProductModal(code)`, `closeProductModal()` — no other task depends on these; they're the feature's entry/exit points.

- [ ] **Step 1: Add `data-open-product` to the catalog card and show the real photo**

In `app/catalog.js`, replace the `renderCatalogGrid` function body (lines 89-122) with:

```js
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
      ? `<img class="product-card-photo" src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.description)}" />`
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
```

(Only additions: `data-open-product` on the `<article>`, and `photoBlock` replacing the hardcoded placeholder div.)

- [ ] **Step 2: Add `renderProductModal` to `catalog.js`**

Add this new export, near `renderCartItems`:

```js
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
```

- [ ] **Step 3: Import `renderProductModal` in `bicifer-app.js`**

In the existing `import { ... } from "./catalog"` block (lines 4-9), add `renderProductModal` to the named imports.

- [ ] **Step 4: Extract the shared qty/add-to-cart handler**

In `app/bicifer-app.js`, replace the existing `on("#catalogGrid", "click", ...)` handler (around line 2191-2219) — extract its body into a standalone function placed just above it:

```js
  function handleCatalogInteraction(e, container) {
    const addBtn = e.target.closest("[data-add-to-cart]");
    const decBtn = e.target.closest("[data-qty-dec]");
    const incBtn = e.target.closest("[data-qty-inc]");

    if (decBtn) {
      const input = container.querySelector(`[data-qty-input="${decBtn.dataset.qtyDec}"]`);
      if (input) input.value = Math.max(1, parseInt(input.value || "1", 10) - 1);
      return true;
    }
    if (incBtn) {
      const input = container.querySelector(`[data-qty-input="${incBtn.dataset.qtyInc}"]`);
      if (input) input.value = parseInt(input.value || "1", 10) + 1;
      return true;
    }
    if (addBtn) {
      const code = addBtn.dataset.addToCart;
      const product = state.products.find((p) => p.code === code);
      if (!product) return true;
      const qtyInput = container.querySelector(`[data-qty-input="${code}"]`);
      const inputQty = Math.max(1, parseInt(qtyInput?.value || "1", 10));
      const currentInCart = getCart().find((i) => i.code === code)?.qty || 0;
      const delta = inputQty - currentInCart;
      if (delta > 0) addToCart(product, delta);
      const newTotal = getCart().find((i) => i.code === code)?.qty || inputQty;
      if (qtyInput) qtyInput.value = newTotal;
      renderCartPanels();
      persistCart();
      return true;
    }
    return false;
  }

  on("#catalogGrid", "click", (e) => {
    if (handleCatalogInteraction(e, $("#catalogGrid"))) return;
    const card = e.target.closest("[data-open-product]");
    if (card) openProductModal(card.dataset.openProduct);
  });
```

(This is a pure extraction — `decBtn`/`incBtn`/`addBtn` behavior is byte-for-byte the same as before, just reusable with an explicit `container` instead of hardcoding `$("#catalogGrid")`. The one addition is the trailing `data-open-product` branch.)

- [ ] **Step 5: Add `openProductModal`/`closeProductModal` and wire the modal's own clicks + Escape**

Near `handleCatalogInteraction`, add:

```js
  function openProductModal(code) {
    const product = state.products.find((p) => p.code === code);
    if (!product) return;
    $("#productModalBody").innerHTML = renderProductModal(product, money, escapeHtml);
    $("#productModal").classList.remove("hidden");
  }

  function closeProductModal() {
    $("#productModal").classList.add("hidden");
  }

  on("#productModal", "click", (e) => {
    if (e.target === $("#productModal") || e.target.closest("[data-close-product-modal]")) {
      closeProductModal();
      return;
    }
    handleCatalogInteraction(e, $("#productModalBody"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#productModal").classList.contains("hidden")) closeProductModal();
  });
```

Place these definitions inside `init()` alongside the other `on(...)` wiring (same scope as the existing `#catalogGrid` handler, since they close over `state`/`money`/`escapeHtml` the same way the rest of `init()` does).

- [ ] **Step 6: Lint and build**

Run: `npx eslint app/bicifer-app.js app/catalog.js`
Expected: clean.

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 7: Manual verification**

With `npm run dev` running, log in as a customer (or owner) and go to Catálogo:
1. Click a product card away from the qty controls and the Agregar button — confirm the modal opens showing title, price, and photo (or placeholder if the test product has none).
2. If the product has a `longDescription` (set one via Task 3/4 on a test product first), confirm it shows in the modal; confirm a product *without* one shows no empty description area.
3. Inside the modal, use +/− and click Agregar — confirm the cart badge/panel updates, same as adding from the grid.
4. Close the modal three ways: the "Cerrar" button, clicking the dark area outside the card, and pressing Escape — confirm all three work.
5. Back in the grid, confirm clicking the qty +/− buttons or "Agregar" directly on the card still does **not** open the modal (this is the regression check for Step 4's extraction).

---

### Task 7: Full end-to-end check with a real Storage upload

**Files:** none (verification only)

- [ ] **Step 1: Full flow against a disposable test product**

With Task 1's SQL applied and `npm run dev` running:
1. Create or reuse a clearly-named test product (e.g. code `TEST999`) — never a real catalog item.
2. Edit it: upload a real photo, add a long description, save.
3. Go to Catálogo, find that product, confirm the small card shows the uploaded photo (not the placeholder).
4. Click it — confirm the modal shows the same photo bigger, plus title/price/description.
5. Delete the test product from Productos — confirm in the Supabase dashboard (Storage → `product-photos`) that its file was also removed.
6. Re-create the same test product via Excel import (with a `descripcion_larga` column) to confirm the import path independently produces a working `longDescription`.

- [ ] **Step 2: Report results to the user**

Summarize what was verified (and any step that didn't behave as expected) to the user. This is a verification-only task with no code changes, so there is nothing to commit here. Per the global constraint, the branch itself (this worktree's commits) is not pushed, merged, or applied to the user's real branch until they explicitly ask for that.
