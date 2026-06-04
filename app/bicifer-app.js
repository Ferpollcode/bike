import { createClient } from "@supabase/supabase-js";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from "chart.js";
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const STORAGE_KEY = "bicifer-remitos-v1";
const PENDING_SYNC_KEY = `${STORAGE_KEY}-pending-sync`;
const SUPABASE_TABLE = "app_state";
const SUPABASE_ROW_ID = "bicifer-remitos";

const defaultState = {
  settings: {
    bizName: "BIKE STORE MDZ",
    bizPhone: "",
    bizAddress: "",
    bizFooter: "Gracias por su compra.",
    nextNumber: 1
  },
  customers: [],
  products: [],
  receipts: [],
  ledger: []
};

let state = structuredClone(defaultState);
let currentReceipt = null;
let editingReceiptId = null;
let editingCustomerId = null;
let supabase = null;
let initialized = false;
let saveTimer = null;
let syncInProgress = false;
let pendingProductImport = null;
let analyticsChart = null;
let analyticsPeriod = "mes";
let editingProductCode = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const on = (selector, eventName, handler) => {
  const element = $(selector);
  if (element) element.addEventListener(eventName, handler);
};
const moduleLabels = {
  venta: "Venta",
  clientes: "Clientes",
  productos: "Productos",
  cuentas: "Cuentas",
  remitos: "Comprobantes",
  ajustes: "Ajustes",
  analiticas: "Analíticas"
};

function localState() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return null;
  }
}

function saveLocalState(nextState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function hasPendingSync() {
  return window.localStorage.getItem(PENDING_SYNC_KEY) === "1";
}

function setPendingSync(isPending) {
  if (isPending) window.localStorage.setItem(PENDING_SYNC_KEY, "1");
  else window.localStorage.removeItem(PENDING_SYNC_KEY);
}

function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function loadState() {
  const fallback = localState() || structuredClone(defaultState);
  if (!supabase) return fallback;

  if (hasPendingSync()) {
    flushPendingSync();
    return fallback;
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("data")
    .eq("id", SUPABASE_ROW_ID)
    .maybeSingle();

  if (error) {
    console.warn("No se pudo leer Supabase. Se usa respaldo local.", error);
    return fallback;
  }

  if (!data?.data) {
    await saveStateToSupabase(fallback);
    return fallback;
  }

  const loaded = { ...structuredClone(defaultState), ...data.data };
  saveLocalState(loaded);
  setPendingSync(false);
  return loaded;
}

async function saveStateToSupabase(nextState) {
  if (!supabase || navigator.onLine === false) return false;
  try {
    const { error } = await supabase.from(SUPABASE_TABLE).upsert({
      id: SUPABASE_ROW_ID,
      data: nextState,
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.warn("No se pudo guardar en Supabase.", error);
      return false;
    }
    setPendingSync(false);
    return true;
  } catch (error) {
    console.warn("No se pudo guardar en Supabase.", error);
    return false;
  }
}

async function flushPendingSync() {
  if (syncInProgress || !hasPendingSync()) return;
  const pendingState = localState();
  if (!pendingState) {
    setPendingSync(false);
    return;
  }

  syncInProgress = true;
  try {
    const synced = await saveStateToSupabase(pendingState);
    if (!synced) setPendingSync(true);
  } finally {
    syncInProgress = false;
  }
}

function saveState() {
  saveLocalState(state);
  setPendingSync(true);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushPendingSync, 250);
}

function bindConnectivityEvents() {
  window.addEventListener("online", flushPendingSync);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) flushPendingSync();
  });
  window.setInterval(flushPendingSync, 30000);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;
  if (process.env.NODE_ENV !== "production") {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()))
      .catch(() => {});
    if ("caches" in window) {
      caches.keys()
        .then((keys) => Promise.all(keys
          .filter((key) => key.startsWith("bicifer-remitos-offline"))
          .map((key) => caches.delete(key))))
        .catch(() => {});
    }
    return;
  }
  navigator.serviceWorker.register("/sw.js").catch((error) => {
    console.warn("No se pudo registrar el modo offline.", error);
  });
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function numberValue(value) {
  return Number(String(value || "0").replace(",", ".")) || 0;
}

function integerValue(value) {
  return Math.max(0, Math.round(numberValue(value)));
}

function priceValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-") return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findColumn(headers, names) {
  return headers.findIndex((header) => names.includes(normalizeHeader(header)));
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeDesc(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseProductsFromRows(rows) {
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("codigo") && headers.includes("precio") &&
      (headers.includes("producto") || headers.includes("descripcion"));
  });

  if (headerRowIndex < 0) {
    return {
      products: [],
      issues: [],
      error: "El Excel debe tener encabezados: codigo, producto, precio"
    };
  }

  const headers = rows[headerRowIndex] || [];
  const codeIndex = findColumn(headers, ["codigo", "code"]);
  const descriptionIndex = findColumn(headers, ["producto", "descripcion", "description"]);
  const priceIndex = findColumn(headers, ["precio", "price"]);

  if (codeIndex < 0 || descriptionIndex < 0 || priceIndex < 0) {
    return {
      products: [],
      issues: [],
      error: "El Excel debe tener encabezados: codigo, producto, precio"
    };
  }

  const products = [];
  const issues = [];
  rows.slice(headerRowIndex + 1).forEach((row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const code = normalizeCode(row[codeIndex]);
    const description = String(row[descriptionIndex] || "").trim();
    const rawPrice = String(row[priceIndex] ?? "").trim();
    const price = priceValue(rawPrice);

    if (!code && !description && !rawPrice) return;
    if (!code || !description) {
      issues.push({
        rowNumber,
        code,
        description,
        price: rawPrice,
        problem: "Falta codigo o producto. No se puede importar esta fila."
      });
      return;
    }

    if (price === null) {
      issues.push({
        rowNumber,
        code,
        description,
        price: rawPrice || "-",
        problem: "Precio faltante o invalido. Se importara con precio 0."
      });
    }

    products.push({ code, description, price: price ?? 0 });
  });

  const byCode = new Map();
  products.forEach((product) => byCode.set(normalizeCode(product.code), product));

  return {
    products: Array.from(byCode.values()),
    issues,
    error: ""
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function businessNameHtml() {
  return String(state.settings.bizName || "")
    .split(/\s+-\s+/)
    .filter(Boolean)
    .map((part) => `<span>${escapeHtml(part)}</span>`)
    .join("");
}

function customerById(id) {
  return state.customers.find((customer) => customer.id === id);
}

function receiptNumber() {
  return String(state.settings.nextNumber).padStart(6, "0");
}

function switchView(viewId) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  $$(".menu-button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  if ($("#moduleMenuButton")) {
    $("#moduleMenuLabel").textContent = moduleLabels[viewId] || "Venta";
    $("#moduleMenuButton").setAttribute("aria-expanded", "false");
    $("#moduleMenuList")?.classList.add("hidden");
    $(".mobile-module-menu")?.setAttribute("data-view", viewId);
    $$("[data-module-option]").forEach((button) => button.classList.toggle("active", button.dataset.moduleOption === viewId));
  }
  render();
}

function render() {
  renderSelects();
  renderCustomers();
  renderProducts();
  renderAccount();
  renderReceipts();
  renderSettings();
  renderAnalytics();
  if ($("#homeBusinessName")) $("#homeBusinessName").textContent = state.settings.bizName || "BIKE STORE MDZ";
  $("#nextReceiptNumber").textContent = `Nro ${receiptNumber()}`;
}

function renderSelects() {
  const selectedSaleCustomer = $("#saleCustomer").value;
  const selectedAccountCustomer = $("#accountCustomer").value;
  const options = state.customers
    .map((customer) => `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`)
    .join("");
  const empty = '<option value="">Seleccionar cliente</option>';
  $("#saleCustomer").innerHTML = empty + options;
  $("#accountCustomer").innerHTML = empty + options;
  $("#saleCustomer").value = selectedSaleCustomer;
  $("#accountCustomer").value = selectedAccountCustomer;
}

function renderCustomers() {
  const list = $("#customersList");
  if (!state.customers.length) {
    list.innerHTML = `<div class="card"><p class="muted">Todavia no hay clientes cargados.</p></div>`;
    return;
  }

  list.innerHTML = state.customers
    .map((customer) => {
      const balance = getBalance(customer.id);
      return `
        <article class="card">
          <h3>${escapeHtml(customer.name)}</h3>
          <p>${escapeHtml(customer.phone || "Sin telefono")}</p>
          <p class="muted">${escapeHtml(customer.address || "Sin direccion")}</p>
          <span class="pill">Saldo ${money(balance)}</span>
          <div class="card-actions">
            <button type="button" data-edit-customer="${customer.id}">Editar</button>
            <button type="button" data-delete-customer="${customer.id}">Borrar</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderProducts() {
  const productSearch = $("#productSearch");
  const productsList = $("#productsList");
  if (!productSearch || !productsList) return;

  const term = productSearch.value.toLowerCase().trim();
  const products = state.products
    .filter((product) => `${product.code} ${product.description}`.toLowerCase().includes(term))
    .sort((a, b) => a.description.localeCompare(b.description));

  productsList.innerHTML = products.length
    ? products
        .map((product) => `
          <article class="card">
            <div class="section-title">
              <h3>${escapeHtml(product.description)}</h3>
              <strong>${money(product.price)}</strong>
            </div>
            <p class="muted">Codigo: ${escapeHtml(product.code)}</p>
            <div class="card-actions">
              <button type="button" data-edit-product="${escapeHtml(product.code)}">Editar</button>
              <button type="button" data-delete-product="${escapeHtml(product.code)}">Borrar</button>
            </div>
          </article>
        `)
        .join("")
    : `<div class="card"><p class="muted">No hay productos cargados.</p></div>`;
}

function getBalance(customerId) {
  return state.ledger
    .filter((entry) => entry.customerId === customerId)
    .reduce((total, entry) => total + entry.amount, 0);
}

function renderAccount() {
  const customerId = $("#accountCustomer").value || state.customers[0]?.id || "";
  if (customerId) $("#accountCustomer").value = customerId;
  $("#accountBalance").textContent = money(getBalance(customerId));

  const entries = state.ledger
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  $("#accountLedger").innerHTML = entries.length
    ? entries
        .map((entry) => `
          <article class="card">
            <div class="section-title">
              <h3>${entry.type === "sale" ? "Venta" : "Pago"}</h3>
              <span class="${entry.amount >= 0 ? "amount-debit" : "amount-credit"}">${money(entry.amount)}</span>
            </div>
            <p>${escapeHtml(entry.note || "")}</p>
            <p class="muted">${entry.date}</p>
          </article>
        `)
        .join("")
    : `<div class="card"><p class="muted">Sin movimientos para este cliente.</p></div>`;
}

function renderReceipts() {
  const term = $("#receiptSearch").value.toLowerCase().trim();
  const receipts = state.receipts
    .filter((receipt) => {
      const customer = customerById(receipt.customerId);
      return !term || receipt.number.includes(term) || customer?.name.toLowerCase().includes(term);
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  $("#receiptsList").innerHTML = receipts.length
    ? receipts
        .map((receipt) => {
          const customer = customerById(receipt.customerId);
          return `
            <article class="card">
              <div class="section-title">
                <h3>Comprobante ${receipt.number}</h3>
                <strong>${money(receipt.total)}</strong>
              </div>
              <p>${escapeHtml(customer?.name || "Cliente eliminado")}</p>
              <p class="muted">${receipt.date} - ${receipt.condition === "cuenta" ? "Cuenta corriente" : "Contado"}</p>
              <div class="card-actions">
                <button type="button" data-open-receipt="${receipt.id}">Ver</button>
                <button type="button" data-edit-receipt="${receipt.id}">Editar</button>
                <button type="button" data-delete-receipt="${receipt.id}">Borrar</button>
                <button type="button" data-wa-receipt="${receipt.id}">WhatsApp</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="card"><p class="muted">No hay comprobantes guardados.</p></div>`;
}

function renderSettings() {
  $("#bizName").value = state.settings.bizName || "";
  $("#bizPhone").value = state.settings.bizPhone || "";
  $("#bizAddress").value = state.settings.bizAddress || "";
  $("#bizFooter").value = state.settings.bizFooter || "";
}

function addSaleLine(item = {}, prepend = false) {
  const line = document.createElement("div");
  line.className = "line-item";
  const qty = integerValue(item.qty || 1) || 1;
  const price = item.price === "" || item.price === undefined || item.price === null ? "" : integerValue(item.price);
  line.innerHTML = `
    <label>Detalle<input class="item-name" type="text" value="${escapeHtml(item.name || "")}" placeholder="Articulo" /></label>
    <label>Cant.<input class="item-qty" inputmode="numeric" min="1" step="1" type="number" value="${qty}" /></label>
    <label>Precio<input class="item-price" inputmode="numeric" min="0" step="1" type="number" value="${price}" /></label>
    <button class="remove-line" type="button">X</button>
  `;
  if (prepend) {
    $("#saleLines").prepend(line);
  } else {
    $("#saleLines").appendChild(line);
  }
  updateSaleTotal();
}

function addProductToSale(product) {
  const price = priceValue(product.price) ?? 0;
  addSaleLine({
    name: `${product.code} - ${product.description}`,
    qty: 1,
    price
  }, true);
}

function getSaleItems() {
  return $$(".line-item")
    .map((line) => ({
      name: line.querySelector(".item-name").value.trim(),
      qty: integerValue(line.querySelector(".item-qty").value),
      price: integerValue(line.querySelector(".item-price").value)
    }))
    .filter((item) => item.name && item.qty > 0);
}

function saleTotal(items = getSaleItems()) {
  return items.reduce((total, item) => total + item.qty * item.price, 0);
}

function updateSaleTotal() {
  $("#saleTotal").textContent = money(saleTotal());
}

function saveCustomer({ name, phone = "", address = "" }) {
  if (editingCustomerId) {
    const existing = customerById(editingCustomerId);
    if (!existing) {
      editingCustomerId = null;
      return null;
    }

    existing.name = name.trim();
    existing.phone = phone.trim();
    existing.address = address.trim();
    editingCustomerId = null;
    $("#customerForm button[type='submit']").textContent = "Guardar cliente";
    saveState();
    render();
    return existing;
  }

  const customer = {
    id: uid("cli"),
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    createdAt: Date.now()
  };
  state.customers.push(customer);
  saveState();
  render();
  return customer;
}

function loadCustomerForEdit(customerId) {
  const customer = customerById(customerId);
  if (!customer) return;
  editingCustomerId = customer.id;
  switchView("clientes");
  $("#customerName").value = customer.name;
  $("#customerPhone").value = customer.phone || "549";
  $("#customerAddress").value = customer.address || "";
  $("#customerForm button[type='submit']").textContent = "Guardar cambios";
}

function deleteCustomer(customerId) {
  const customer = customerById(customerId);
  if (!customer) return;

  const hasReceipts = state.receipts.some((receipt) => receipt.customerId === customerId);
  const hasLedger = state.ledger.some((entry) => entry.customerId === customerId);
  if (hasReceipts || hasLedger) {
    alert("No se puede borrar este cliente porque tiene comprobantes o movimientos de cuenta corriente.");
    return;
  }

  if (!confirm(`¿Borrar el cliente ${customer.name}?`)) return;
  state.customers = state.customers.filter((item) => item.id !== customerId);
  if (editingCustomerId === customerId) {
    editingCustomerId = null;
    $("#customerForm").reset();
    $("#customerPhone").value = "549";
    $("#customerForm button[type='submit']").textContent = "Guardar cliente";
  }
  saveState();
  render();
}

function saveReceipt() {
  const customerId = $("#saleCustomer").value;
  const items = getSaleItems();
  const customer = customerById(customerId);

  if (!customer) {
    alert("Selecciona o agrega un cliente.");
    return;
  }

  if (!items.length) {
    alert("Agrega al menos un articulo con cantidad.");
    return;
  }

  const existingReceipt = editingReceiptId ? state.receipts.find((item) => item.id === editingReceiptId) : null;
  const receipt = {
    id: existingReceipt?.id || uid("rem"),
    number: existingReceipt?.number || receiptNumber(),
    customerId,
    date: $("#saleDate").value || today(),
    condition: $("#saleCondition").value,
    notes: $("#saleNotes").value.trim(),
    items,
    total: saleTotal(items),
    createdAt: existingReceipt?.createdAt || Date.now()
  };

  if (existingReceipt) {
    state.receipts = state.receipts.map((item) => item.id === existingReceipt.id ? receipt : item);
    state.ledger = state.ledger.filter((entry) => entry.receiptId !== existingReceipt.id);
  } else {
    state.receipts.push(receipt);
  }

  if (receipt.condition === "cuenta") {
    state.ledger.push({
      id: uid("mov"),
      customerId,
      type: "sale",
      amount: receipt.total,
      date: receipt.date,
      note: `Comprobante ${receipt.number}`,
      receiptId: receipt.id,
      createdAt: Date.now()
    });
  }
  if (!existingReceipt) state.settings.nextNumber += 1;
  editingReceiptId = null;
  $("#saveSale").textContent = "Guardar y generar comprobante";
  saveState();
  resetSaleForm();
  openReceipt(receipt.id);
  render();
}

function resetSaleForm() {
  $("#saleNotes").value = "";
  $("#saleCondition").value = "cuenta";
  $("#saleLines").innerHTML = "";
  updateSaleTotal();
}

function loadReceiptForEdit(receiptId) {
  const receipt = state.receipts.find((item) => item.id === receiptId);
  if (!receipt) return;

  editingReceiptId = receipt.id;
  $("#receiptModal").classList.add("hidden");
  switchView("venta");
  $("#saleCustomer").value = receipt.customerId;
  $("#saleDate").value = receipt.date;
  $("#saleCondition").value = receipt.condition;
  $("#saleNotes").value = receipt.notes || "";
  $("#saleLines").innerHTML = "";
  receipt.items.forEach((item) => addSaleLine(item));
  $("#saveSale").textContent = `Guardar cambios comprobante ${receipt.number}`;
  updateSaleTotal();
}

function deleteReceipt(receiptId) {
  const receipt = state.receipts.find((item) => item.id === receiptId);
  if (!receipt) return;
  if (!confirm(`¿Borrar el comprobante ${receipt.number}?`)) return;

  state.receipts = state.receipts.filter((item) => item.id !== receiptId);
  state.ledger = state.ledger.filter((entry) => entry.receiptId !== receiptId);
  if (editingReceiptId === receiptId) {
    editingReceiptId = null;
    $("#saveSale").textContent = "Guardar y generar comprobante";
    resetSaleForm();
  }
  currentReceipt = null;
  $("#receiptModal").classList.add("hidden");
  saveState();
  render();
}

function receiptText(receipt) {
  const customer = customerById(receipt.customerId);
  const lines = receipt.items
    .map((item) => `- ${item.qty} x ${item.name}: ${money(item.qty * item.price)}`)
    .join("\n");
  const balanceLine = receipt.condition === "cuenta" ? `\nSaldo actual: ${money(getBalance(receipt.customerId))}` : "";
  return `${state.settings.bizName}\nComprobante ${receipt.number} - ${receipt.date}\nCliente: ${customer?.name || ""}\n\n${lines}\n\nTotal: ${money(receipt.total)}\nCondicion: ${receipt.condition === "cuenta" ? "Cuenta corriente" : "Contado"}${balanceLine}\n${receipt.notes ? `\nObs: ${receipt.notes}` : ""}\n\n${state.settings.bizFooter || ""}`;
}

function pdfEscape(value) {
  return String(value || "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function splitText(text, maxLength = 78) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if ((line + " " + word).trim().length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines;
}

function centeredPdfX(value, size = 9) {
  const clean = String(value || "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
  const approxWidth = clean.length * size * 0.5;
  return Math.max(40, (595 - approxWidth) / 2);
}

function buildReceiptPdf(receipt) {
  const customer = customerById(receipt.customerId);
  const streamLines = [];
  const text = (value, x, y, size = 10, color = "0 0 0") => {
    streamLines.push(`BT ${color} rg /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, width = 1) => {
    streamLines.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const strokeRect = (x, y, width, height) => {
    streamLines.push(`${x} ${y} ${width} ${height} re S`);
  };
  const fillRect = (x, y, width, height, color = "0.06 0.46 0.43") => {
    streamLines.push(`${color} rg ${x} ${y} ${width} ${height} re f 0 0 0 rg`);
  };

  const businessLines = String(state.settings.bizName || "").split(/\s+-\s+/).filter(Boolean);
  text(businessLines[0] || state.settings.bizName, 40, 790, 18);
  if (businessLines[1]) text(businessLines.slice(1).join(" - "), 40, 770, 14);
  const businessInfoY = businessLines[1] ? 752 : 770;
  if (state.settings.bizAddress) text(state.settings.bizAddress, 40, businessInfoY, 10);
  if (state.settings.bizPhone) text(state.settings.bizPhone, 40, businessInfoY - 15, 10);
  fillRect(410, 758, 130, 42);
  text("COMPROBANTE", 430, 782, 12, "1 1 1");
  text(`Nro ${receipt.number}`, 450, 764, 10, "1 1 1");
  text(`Fecha ${receipt.date}`, 435, 748, 10);
  line(40, 735, 555, 735, 2);

  fillRect(40, 675, 515, 44, "0.97 0.98 0.99");
  strokeRect(40, 675, 515, 44);
  text("CLIENTE", 52, 704, 10);
  text(customer?.name || "", 52, 688, 12);
  if (customer?.address) text(`Direccion: ${customer.address}`, 260, 704, 9);
  if (customer?.phone) text(`Telefono: ${customer.phone}`, 260, 688, 9);

  let y = 638;
  fillRect(40, y, 515, 24, "0.09 0.13 0.16");
  text("Detalle", 50, y + 8, 10, "1 1 1");
  text("Cant.", 355, y + 8, 10, "1 1 1");
  text("Precio", 415, y + 8, 10, "1 1 1");
  text("Subtotal", 488, y + 8, 10, "1 1 1");
  y -= 22;

  receipt.items.forEach((item, index) => {
    if (y < 145) return;
    if (index % 2 === 1) fillRect(40, y - 4, 515, 20, "0.97 0.98 0.99");
    splitText(item.name, 48).forEach((descriptionLine, lineIndex) => {
      if (y < 145) return;
      text(descriptionLine, 50, y, 9);
      if (lineIndex === 0) {
        text(String(item.qty), 365, y, 9);
        text(money(item.price), 410, y, 9);
        text(money(item.qty * item.price), 490, y, 9);
      }
      y -= 14;
    });
    y -= 6;
  });

  fillRect(365, 95, 190, 34);
  text("TOTAL", 382, 107, 12, "1 1 1");
  text(money(receipt.total), 455, 107, 12, "1 1 1");
  text(`Condicion: ${receipt.condition === "cuenta" ? "Cuenta corriente" : "Contado"}`, 40, 112, 10);
  if (receipt.condition === "cuenta") text(`Saldo actual: ${money(getBalance(receipt.customerId))}`, 40, 96, 10);
  if (receipt.notes) {
    splitText(`Obs: ${receipt.notes}`, 80).slice(0, 2).forEach((noteLine, index) => text(noteLine, 40, 78 - index * 13, 9));
  }
  line(40, 55, 555, 55, 0.6);
  text(state.settings.bizFooter || "", centeredPdfX(state.settings.bizFooter || "", 9), 38, 9);

  const stream = streamLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadReceiptPdf(receipt) {
  const blob = buildReceiptPdf(receipt);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comprobante-${receipt.number}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

async function shareReceiptPdf(receipt) {
  const blob = buildReceiptPdf(receipt);
  const file = new File([blob], `comprobante-${receipt.number}.pdf`, { type: "application/pdf" });
  const customer = customerById(receipt.customerId);
  const shareData = {
    title: `Comprobante ${receipt.number}`,
    text: `Comprobante ${receipt.number} - ${customer?.name || ""}`,
    files: [file]
  };

  if (navigator.canShare?.(shareData) && navigator.share) {
    await navigator.share(shareData);
    return;
  }

  downloadReceiptPdf(receipt);
  alert("Tu navegador no permite adjuntar el PDF automaticamente. Se descargo el comprobante: envialo por WhatsApp como documento.");
}

function buildAccountPdf(customerId) {
  const customer = customerById(customerId);
  if (!customer) return null;

  const entries = state.ledger
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  const streamLines = [];
  const text = (value, x, y, size = 10, color = "0 0 0") => {
    streamLines.push(`BT ${color} rg /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, width = 1) => {
    streamLines.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const strokeRect = (x, y, width, height) => {
    streamLines.push(`${x} ${y} ${width} ${height} re S`);
  };
  const fillRect = (x, y, width, height, color = "0.06 0.46 0.43") => {
    streamLines.push(`${color} rg ${x} ${y} ${width} ${height} re f 0 0 0 rg`);
  };

  text(state.settings.bizName, 40, 795, 18);
  if (state.settings.bizAddress) text(state.settings.bizAddress, 40, 775, 10);
  if (state.settings.bizPhone) text(state.settings.bizPhone, 40, 760, 10);
  fillRect(380, 758, 175, 42);
  text("CUENTA CORRIENTE", 405, 782, 12, "1 1 1");
  text(`Fecha ${today()}`, 425, 764, 10, "1 1 1");
  line(40, 735, 555, 735, 2);

  fillRect(40, 675, 515, 44, "0.97 0.98 0.99");
  strokeRect(40, 675, 515, 44);
  text("CLIENTE", 52, 704, 10);
  text(customer.name || "", 52, 688, 12);
  if (customer.address) text(`Direccion: ${customer.address}`, 260, 704, 9);
  if (customer.phone) text(`Telefono: ${customer.phone}`, 260, 688, 9);

  let y = 638;
  fillRect(40, y, 515, 24, "0.09 0.13 0.16");
  text("Fecha", 50, y + 8, 10, "1 1 1");
  text("Detalle", 120, y + 8, 10, "1 1 1");
  text("Venta", 355, y + 8, 10, "1 1 1");
  text("Pago", 430, y + 8, 10, "1 1 1");
  text("Saldo", 505, y + 8, 10, "1 1 1");
  y -= 24;

  let runningBalance = 0;
  entries.forEach((entry, index) => {
    if (y < 112) return;
    runningBalance += entry.amount;
    if (index % 2 === 1) fillRect(40, y - 5, 515, 20, "0.97 0.98 0.99");
    text(entry.date, 50, y, 9);
    splitText(entry.note || (entry.type === "sale" ? "Venta" : "Pago"), 36).slice(0, 1)
      .forEach((noteLine) => text(noteLine, 120, y, 9));
    text(entry.amount > 0 ? money(entry.amount) : "-", 340, y, 9);
    text(entry.amount < 0 ? money(Math.abs(entry.amount)) : "-", 420, y, 9);
    text(money(runningBalance), 490, y, 9);
    y -= 20;
  });

  fillRect(365, 60, 190, 34);
  text("SALDO FINAL", 382, 72, 12, "1 1 1");
  text(money(getBalance(customerId)), 465, 72, 12, "1 1 1");
  line(40, 45, 555, 45, 0.6);
  text(state.settings.bizFooter || "", centeredPdfX(state.settings.bizFooter || "", 9), 28, 9);

  const stream = streamLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadAccountPdf(customerId) {
  const customer = customerById(customerId);
  const blob = buildAccountPdf(customerId);
  if (!customer || !blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cuenta-${customer.name || "cliente"}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

async function shareAccountPdf(customerId) {
  const customer = customerById(customerId);
  const blob = buildAccountPdf(customerId);
  if (!customer || !blob) {
    alert("Selecciona un cliente para enviar su cuenta corriente.");
    return;
  }

  const file = new File([blob], `cuenta-${customer.name || "cliente"}.pdf`, { type: "application/pdf" });
  const shareData = {
    title: `Cuenta corriente - ${customer.name}`,
    text: `Estado de cuenta corriente - ${customer.name}`,
    files: [file]
  };

  if (navigator.canShare?.(shareData) && navigator.share) {
    await navigator.share(shareData);
    return;
  }

  downloadAccountPdf(customerId);
  alert("Tu navegador no permite adjuntar el PDF automaticamente. Se descargo la cuenta corriente: enviala por WhatsApp como documento.");
}

function openWhatsappText(receipt) {
  const customer = customerById(receipt.customerId);
  const phone = (customer?.phone || "").replace(/\D/g, "");
  const text = encodeURIComponent(receiptText(receipt));
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

function openReceipt(receiptId) {
  const receipt = state.receipts.find((item) => item.id === receiptId);
  if (!receipt) return;

  currentReceipt = receipt;
  const customer = customerById(receipt.customerId);
  $("#receiptPreview").innerHTML = `
    <div class="receipt-header">
      <div class="receipt-business">
        <h2 class="receipt-business-name">${businessNameHtml()}</h2>
        <p>${escapeHtml(state.settings.bizAddress || "")}</p>
        <p>${escapeHtml(state.settings.bizPhone || "")}</p>
      </div>
      <div class="receipt-meta">
        <h3>Comprobante</h3>
        <p>Nro ${receipt.number}</p>
        <p>${receipt.date}</p>
      </div>
    </div>
    <section class="receipt-client">
      <h3>Cliente</h3>
      <p>${escapeHtml(customer?.name || "")}</p>
      <p>${escapeHtml(customer?.address || "")}</p>
      <p>${escapeHtml(customer?.phone || "")}</p>
    </section>
    <table class="receipt-table">
      <thead>
        <tr>
          <th>Detalle</th>
          <th>Cant.</th>
          <th>Precio</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${receipt.items
          .map((item) => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${item.qty}</td>
              <td>${money(item.price)}</td>
              <td>${money(item.qty * item.price)}</td>
            </tr>
          `)
          .join("")}
      </tbody>
    </table>
    <div class="receipt-total"><span>Total</span><span>${money(receipt.total)}</span></div>
    <div class="receipt-summary">
      <p><strong>Condicion:</strong> ${receipt.condition === "cuenta" ? "Cuenta corriente" : "Contado"}</p>
      ${receipt.condition === "cuenta" ? `<p><strong>Saldo actual:</strong> ${money(getBalance(receipt.customerId))}</p>` : ""}
      ${receipt.notes ? `<p><strong>Observaciones:</strong> ${escapeHtml(receipt.notes)}</p>` : ""}
    </div>
    <p class="receipt-footer">${escapeHtml(state.settings.bizFooter || "")}</p>
  `;
  $("#receiptModal").classList.remove("hidden");
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

function decodeBytes(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("El navegador no puede descomprimir archivos Excel.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipXlsx(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOffset = -1;

  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (readUint32(view, index) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }

  if (endOffset < 0) throw new Error("No se pudo leer el archivo Excel.");

  const entriesCount = readUint16(view, endOffset + 10);
  const centralOffset = readUint32(view, endOffset + 16);
  const files = {};
  let offset = centralOffset;

  for (let entry = 0; entry < entriesCount; entry += 1) {
    if (readUint32(view, offset) !== 0x02014b50) break;
    const method = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localOffset = readUint32(view, offset + 42);
    const name = decodeBytes(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    if (method === 0) files[name] = decodeBytes(compressed);
    if (method === 8) files[name] = decodeBytes(await inflateRaw(compressed));

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function cellColumnIndex(reference) {
  const letters = reference.replace(/[0-9]/g, "");
  return letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.querySelectorAll("si")).map((item) =>
    Array.from(item.querySelectorAll("t")).map((node) => node.textContent || "").join("")
  );
}

function parseSheetRows(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.querySelectorAll("sheetData row")).map((rowNode) => {
    const row = [];
    Array.from(rowNode.querySelectorAll("c")).forEach((cell) => {
      const index = cellColumnIndex(cell.getAttribute("r") || "A1");
      const type = cell.getAttribute("t");
      const valueNode = cell.querySelector("v");
      let value = "";

      if (type === "s") value = sharedStrings[Number(valueNode?.textContent || 0)] || "";
      else if (type === "inlineStr") value = cell.querySelector("is t")?.textContent || "";
      else value = valueNode?.textContent || "";

      row[index] = value;
    });
    return row.map((value) => String(value || "").trim());
  }).filter((row) => row.some(Boolean));
}

async function readExcelRows(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "xls") {
    throw new Error("El formato .xls antiguo no se puede leer en esta app local. Abrilo en Excel y guardalo como .xlsx.");
  }

  const files = await unzipXlsx(await file.arrayBuffer());
  const sheetName = Object.keys(files).find((name) => name.startsWith("xl/worksheets/sheet"));
  if (!sheetName) throw new Error("No se encontro una hoja dentro del Excel.");
  return parseSheetRows(files[sheetName], parseSharedStrings(files["xl/sharedStrings.xml"]));
}

function renderProductImportPreview() {
  const preview = $("#productImportPreview");
  if (!preview) return;

  if (!pendingProductImport) {
    preview.classList.add("hidden");
    $("#productImportSummary").textContent = "";
    $("#productImportStats").textContent = "";
    $("#productImportSample").innerHTML = "";
    $("#productImportWarnings").textContent = "";
    return;
  }

  const imported = pendingProductImport.products;
  const issues = pendingProductImport.issues;
  const existingCodes = new Set(state.products.map((product) => normalizeCode(product.code)));
  const updatedCount = imported.filter((product) => existingCodes.has(normalizeCode(product.code))).length;
  const newCount = imported.length - updatedCount;
  const sample = imported.slice(0, 8);
  const issueSample = issues.slice(0, 8);

  const existingByDesc = new Map(state.products.map((p) => [normalizeDesc(p.description), p]));
  const nameConflicts = imported.filter((p) => {
    const existing = existingByDesc.get(normalizeDesc(p.description));
    return existing && normalizeCode(existing.code) !== normalizeCode(p.code);
  });

  $("#productImportSummary").textContent = `${imported.length} validos`;
  const conflictNote = nameConflicts.length ? `, ${nameConflicts.length} con nombre duplicado` : "";
  $("#productImportStats").textContent = `${newCount} nuevos, ${updatedCount} actualizan existentes${conflictNote}, ${issues.length} con observaciones.`;
  $("#productImportSample").innerHTML = sample.length
    ? sample.map((product) => `
        <div class="import-row">
          <span>${escapeHtml(product.code)}</span>
          <span>${escapeHtml(product.description)}</span>
          <strong>${money(product.price)}</strong>
        </div>
      `).join("")
    : `<p class="muted">No hay productos validos para importar.</p>`;

  const conflictHtml = nameConflicts.length
    ? `<strong style="color:var(--danger)">Nombres duplicados (distinto codigo)</strong>
       ${nameConflicts.slice(0, 5).map((p) => {
         const existing = existingByDesc.get(normalizeDesc(p.description));
         return `<span>⚠ "${escapeHtml(p.description)}" — en el Excel: ${escapeHtml(p.code)}, ya existe como: ${escapeHtml(existing.code)}</span>`;
       }).join("")}
       ${nameConflicts.length > 5 ? `<span>Y ${nameConflicts.length - 5} conflictos mas.</span>` : ""}`
    : "";
  const issueHtml = issueSample.length
    ? `<strong>Observaciones</strong>
       ${issueSample.map((item) => `
         <span>Fila ${item.rowNumber}: ${escapeHtml(item.code || "sin codigo")} - ${escapeHtml(item.description || "sin producto")} (${escapeHtml(item.problem)})</span>
       `).join("")}
       ${issues.length > issueSample.length ? `<span>Y ${issues.length - issueSample.length} observaciones mas.</span>` : ""}`
    : "No se detectaron filas con observaciones.";

  $("#productImportWarnings").innerHTML = [conflictHtml, issueHtml].filter(Boolean).join("<br>");
  preview.classList.remove("hidden");
}

function prepareProductImport(rows) {
  const parsed = parseProductsFromRows(rows);
  if (parsed.error) {
    pendingProductImport = null;
    renderProductImportPreview();
    alert(parsed.error);
    return;
  }

  pendingProductImport = parsed;
  renderProductImportPreview();
}

function confirmProductImport() {
  if (!pendingProductImport) return;
  const imported = pendingProductImport.products;
  if (!imported.length) {
    alert("No hay productos validos para importar.");
    return;
  }

  const existingByDesc = new Map(state.products.map((p) => [normalizeDesc(p.description), p]));
  const nameConflicts = imported.filter((p) => {
    const existing = existingByDesc.get(normalizeDesc(p.description));
    return existing && normalizeCode(existing.code) !== normalizeCode(p.code);
  });

  if (nameConflicts.length > 0) {
    const lines = nameConflicts.slice(0, 5).map((p) => {
      const existing = existingByDesc.get(normalizeDesc(p.description));
      return `• "${p.description}"\n  Excel: ${p.code} | Existente: ${existing.code}`;
    });
    const more = nameConflicts.length > 5 ? `\n...y ${nameConflicts.length - 5} mas.` : "";
    const msg = `Hay ${nameConflicts.length} producto(s) con un nombre que ya existe con otro codigo:\n\n${lines.join("\n\n")}${more}\n\n¿Importar igual y mantener ambos registros?`;
    if (!confirm(msg)) return;
  }

  const byCode = new Map(state.products.map((product) => [normalizeCode(product.code), product]));
  imported.forEach((product) => byCode.set(normalizeCode(product.code), product));
  state.products = Array.from(byCode.values());
  const importedCount = imported.length;
  const issueCount = pendingProductImport.issues.length;
  pendingProductImport = null;
  saveState();
  render();
  renderProductImportPreview();
  alert(`Productos importados: ${importedCount}${issueCount ? `. Filas con observaciones: ${issueCount}` : ""}`);
}

function cancelProductImport() {
  pendingProductImport = null;
  renderProductImportPreview();
}

function loadProductForEdit(code) {
  const product = state.products.find((p) => normalizeCode(p.code) === normalizeCode(code));
  if (!product) return;
  editingProductCode = product.code;
  $("#editProductCode").value = product.code;
  $("#editProductDescription").value = product.description;
  $("#editProductPrice").value = product.price;
  $("#productEditPanel").classList.remove("hidden");
  $("#productEditPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

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
  state.products[idx] = { ...state.products[idx], code: newCode, description: newDesc, price: newPrice };
  editingProductCode = null;
  $("#productEditPanel").classList.add("hidden");
  saveState();
  render();
}

function deleteProduct(code) {
  const product = state.products.find((p) => normalizeCode(p.code) === normalizeCode(code));
  if (!product) return;
  if (!confirm(`¿Borrar "${product.description}"?`)) return;
  state.products = state.products.filter((p) => normalizeCode(p.code) !== normalizeCode(code));
  if (editingProductCode && normalizeCode(editingProductCode) === normalizeCode(code)) {
    editingProductCode = null;
    $("#productEditPanel").classList.add("hidden");
  }
  saveState();
  render();
}

function findProductFromPickerValue(value) {
  const term = String(value || "").trim();
  if (!term) return null;

  const codeFromOption = normalizeCode(term.split(" - ")[0]);
  const exactCode = state.products.find((product) => normalizeCode(product.code) === codeFromOption);
  if (exactCode) return exactCode;

  const normalizedTerm = term.toLowerCase();
  return state.products.find((product) =>
    normalizeCode(product.code).toLowerCase() === normalizedTerm ||
    String(product.description || "").toLowerCase() === normalizedTerm ||
    `${product.code} ${product.description}`.toLowerCase().includes(normalizedTerm)
  ) || null;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bicifer-respaldo-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  if ($("#moduleMenuButton")) {
    $("#moduleMenuButton").addEventListener("click", () => {
      const list = $("#moduleMenuList");
      const isOpen = !list.classList.contains("hidden");
      list.classList.toggle("hidden", isOpen);
      $("#moduleMenuButton").setAttribute("aria-expanded", String(!isOpen));
    });
    $("#moduleMenuList").addEventListener("click", (event) => {
      const option = event.target.closest("[data-module-option]");
      if (option) switchView(option.dataset.moduleOption);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest(".mobile-module-menu")) return;
      $("#moduleMenuList")?.classList.add("hidden");
      $("#moduleMenuButton")?.setAttribute("aria-expanded", "false");
    });
  }
  $$(".menu-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$(".back-home").forEach((button) => button.addEventListener("click", () => switchView("inicio")));

  on("#addLine", "click", () => addSaleLine({}, true));
  on("#saleLines", "input", updateSaleTotal);
  on("#saleLines", "change", (event) => {
    if (event.target.classList.contains("item-qty")) {
      event.target.value = integerValue(event.target.value) || 1;
    }
    if (event.target.classList.contains("item-price")) {
      event.target.value = integerValue(event.target.value);
    }
    updateSaleTotal();
  });
  on("#saleLines", "click", (event) => {
    if (!event.target.classList.contains("remove-line")) return;
    event.target.closest(".line-item").remove();
    updateSaleTotal();
  });

  on("#quickAddCustomer", "click", () => {
    const name = $("#quickCustomerName").value.trim();
    if (!name) return;
    const customer = saveCustomer({ name });
    $("#saleCustomer").value = customer.id;
    $("#quickCustomerName").value = "";
  });

  on("#customerForm", "submit", (event) => {
    event.preventDefault();
    saveCustomer({
      name: $("#customerName").value,
      phone: $("#customerPhone").value,
      address: $("#customerAddress").value
    });
    event.target.reset();
    $("#customerPhone").value = "549";
  });

  on("#customersList", "click", (event) => {
    const editId = event.target.dataset.editCustomer;
    const deleteId = event.target.dataset.deleteCustomer;
    if (editId) loadCustomerForEdit(editId);
    if (deleteId) deleteCustomer(deleteId);
  });

  on("#analiticas", "click", (event) => {
    const btn = event.target.closest(".period-btn");
    if (!btn) return;
    analyticsPeriod = btn.dataset.period;
    $$(".period-btn").forEach((b) => b.classList.toggle("active", b.dataset.period === analyticsPeriod));
    renderAnalytics();
  });

  on("#productsList", "click", (event) => {
    const editCode = event.target.dataset.editProduct;
    const deleteCode = event.target.dataset.deleteProduct;
    if (editCode) loadProductForEdit(editCode);
    if (deleteCode) deleteProduct(deleteCode);
  });
  on("#productEditForm", "submit", saveProductEdit);
  on("#cancelProductEdit", "click", () => {
    editingProductCode = null;
    $("#productEditPanel").classList.add("hidden");
  });

  on("#saveSale", "click", saveReceipt);
  on("#accountCustomer", "change", renderAccount);
  on("#receiptSearch", "input", renderReceipts);
  on("#productSearch", "input", renderProducts);
  const productPicker = $("#productPicker");
  const productDropdown = $("#productDropdown");

  if (!productPicker || !productDropdown) {
    console.warn("productPicker or productDropdown not found");
  }

  function updateProductDropdown() {
    const term = productPicker.value.toLowerCase().trim();
    if (!term) {
      productDropdown.classList.add("hidden");
      return;
    }
    const matches = state.products
      .filter((p) => `${p.code} ${p.description}`.toLowerCase().includes(term))
      .slice(0, 25);
    if (!matches.length) {
      productDropdown.innerHTML = `<div class="product-dropdown-empty">Sin resultados</div>`;
      productDropdown.classList.remove("hidden");
      return;
    }
    productDropdown.innerHTML = matches
      .map((p) => `<div class="product-dropdown-item" data-code="${escapeHtml(p.code)}"><strong>${escapeHtml(p.description)}</strong> &mdash; ${money(p.price)}<br><small class="muted">${escapeHtml(p.code)}</small></div>`)
      .join("");
    productDropdown.classList.remove("hidden");
  }

  if (productPicker && productDropdown) productPicker.addEventListener("input", updateProductDropdown);
  if (productPicker && productDropdown) productPicker.addEventListener("focus", updateProductDropdown);
  if (productPicker && productDropdown) productPicker.addEventListener("blur", () => {
    setTimeout(() => productDropdown.classList.add("hidden"), 200);
  });
  if (productDropdown) productDropdown.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".product-dropdown-item");
    if (!item) return;
    e.preventDefault();
    const product = state.products.find((p) => p.code === item.dataset.code);
    if (!product) return;
    addProductToSale(product);
    productPicker.value = "";
    productDropdown.classList.add("hidden");
  });
  if (productDropdown) productDropdown.addEventListener("touchstart", (e) => {
    const item = e.target.closest(".product-dropdown-item");
    if (!item) return;
    const product = state.products.find((p) => p.code === item.dataset.code);
    if (!product) return;
    addProductToSale(product);
    productPicker.value = "";
    productDropdown.classList.add("hidden");
    productPicker.blur();
  });

  on("#savePayment", "click", () => {
    const customerId = $("#accountCustomer").value;
    const amount = numberValue($("#paymentAmount").value);
    if (!customerId || amount <= 0) {
      alert("Selecciona un cliente e ingresa un importe.");
      return;
    }
    state.ledger.push({
      id: uid("mov"),
      customerId,
      type: "payment",
      amount: -amount,
      date: $("#paymentDate").value || today(),
      note: $("#paymentNote").value.trim() || "Pago",
      createdAt: Date.now()
    });
    saveState();
    $("#paymentAmount").value = "";
    $("#paymentNote").value = "";
    render();
  });
  on("#shareAccountPdf", "click", () => {
    shareAccountPdf($("#accountCustomer").value);
  });

  on("#settingsForm", "submit", (event) => {
    event.preventDefault();
    state.settings.bizName = $("#bizName").value.trim() || "BIKE STORE MDZ";
    state.settings.bizPhone = $("#bizPhone").value.trim();
    state.settings.bizAddress = $("#bizAddress").value.trim();
    state.settings.bizFooter = $("#bizFooter").value.trim();
    saveState();
    render();
    alert("Ajustes guardados.");
  });

  on("#receiptsList", "click", (event) => {
    const openId = event.target.dataset.openReceipt;
    const editId = event.target.dataset.editReceipt;
    const deleteId = event.target.dataset.deleteReceipt;
    const waId = event.target.dataset.waReceipt;
    if (openId) openReceipt(openId);
    if (editId) loadReceiptForEdit(editId);
    if (deleteId) deleteReceipt(deleteId);
    if (waId) {
      const receipt = state.receipts.find((item) => item.id === waId);
      if (receipt) shareReceiptPdf(receipt);
    }
  });

  on("#closeReceipt", "click", () => $("#receiptModal")?.classList.add("hidden"));
  on("#editReceipt", "click", () => currentReceipt && loadReceiptForEdit(currentReceipt.id));
  on("#deleteReceipt", "click", () => currentReceipt && deleteReceipt(currentReceipt.id));
  on("#printReceipt", "click", () => window.print());
  on("#downloadPdf", "click", () => currentReceipt && downloadReceiptPdf(currentReceipt));
  on("#whatsappReceipt", "click", () => currentReceipt && shareReceiptPdf(currentReceipt));
  on("#exportData", "click", exportData);

  on("#importData", "change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (!imported.customers || !imported.receipts || !imported.ledger) throw new Error("Formato invalido");
      state = { ...structuredClone(defaultState), ...imported };
      saveState();
      render();
      alert("Respaldo importado.");
    } catch {
      alert("No se pudo importar el archivo.");
    }
    event.target.value = "";
  });

  on("#importProducts", "change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      prepareProductImport(await readExcelRows(file));
    } catch (error) {
      alert(error.message || "No se pudo leer el archivo Excel.");
    }
    event.target.value = "";
  });
  on("#confirmProductImport", "click", confirmProductImport);
  on("#cancelProductImport", "click", cancelProductImport);

  on("#clearProducts", "click", () => {
    const count = state.products.length;
    if (!count) return;
    if (!confirm(`¿Vaciar la lista de productos?\n\nEsto borrará ${count} producto${count !== 1 ? "s" : ""} de forma permanente. Esta acción no se puede deshacer.`)) return;
    state.products = [];
    pendingProductImport = null;
    saveState();
    render();
    renderProductImportPreview();
  });
}

function getPeriodRange(period) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (period === "mes") {
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return { start, end: todayStr };
  }
  if (period === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { start: d.toISOString().slice(0, 10), end: todayStr };
  }
  if (period === "anio") {
    return { start: `${now.getFullYear()}-01-01`, end: todayStr };
  }
  return { start: "0000-01-01", end: "9999-12-31" };
}

function buildChartData(receipts, useMonths) {
  const map = new Map();
  receipts.forEach((r) => {
    const key = useMonths ? r.date.slice(0, 7) : r.date;
    map.set(key, (map.get(key) || 0) + r.total);
  });
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const labels = sorted.map(([key]) => {
    const parts = key.split("-");
    if (useMonths) return `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
    return `${parseInt(parts[2], 10)} ${monthNames[parseInt(parts[1], 10) - 1]}`;
  });
  const data = sorted.map(([, total]) => total);
  return { labels, data };
}

function computeAnalytics(period) {
  const { start, end } = getPeriodRange(period);
  const receiptsInPeriod = state.receipts.filter((r) => r.date >= start && r.date <= end);
  const ledgerInPeriod = state.ledger.filter((e) => e.date >= start && e.date <= end);

  const totalVendido = receiptsInPeriod.reduce((sum, r) => sum + r.total, 0);
  const cantidadRemitos = receiptsInPeriod.length;
  const contadoTotal = receiptsInPeriod.filter((r) => r.condition === "contado").reduce((sum, r) => sum + r.total, 0);
  const cuentaTotal = receiptsInPeriod.filter((r) => r.condition === "cuenta").reduce((sum, r) => sum + r.total, 0);
  const pagosTotal = ledgerInPeriod.filter((e) => e.type === "payment").reduce((sum, e) => sum + e.amount, 0);
  const ingresadoCaja = contadoTotal + pagosTotal;
  const saldoDeudorTotal = state.customers.reduce((sum, c) => {
    const b = getBalance(c.id);
    return sum + (b < 0 ? -b : 0);
  }, 0);

  const totalCondicion = contadoTotal + cuentaTotal;
  const pctContado = totalCondicion > 0 ? (contadoTotal / totalCondicion) * 100 : 0;
  const pctCuenta = totalCondicion > 0 ? (cuentaTotal / totalCondicion) * 100 : 0;

  const useMonths = period === "anio" || period === "todo";
  const chartData = buildChartData(receiptsInPeriod, useMonths);

  const prodByQty = new Map();
  const prodByMonto = new Map();
  receiptsInPeriod.forEach((r) => {
    (r.items || []).forEach((item) => {
      const name = item.name || "Sin nombre";
      prodByQty.set(name, (prodByQty.get(name) || 0) + item.qty);
      prodByMonto.set(name, (prodByMonto.get(name) || 0) + item.qty * item.price);
    });
  });
  const topByQty = [...prodByQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topByMonto = [...prodByMonto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const clientByCompra = new Map();
  receiptsInPeriod.forEach((r) => {
    if (r.customerId) clientByCompra.set(r.customerId, (clientByCompra.get(r.customerId) || 0) + r.total);
  });
  const topByCompra = [...clientByCompra.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, total]) => {
      const c = customerById(id);
      return { name: c ? c.name : "(cliente eliminado)", total };
    });

  const topByDeuda = state.customers
    .map((c) => ({ name: c.name, balance: getBalance(c.id) }))
    .filter((c) => c.balance < 0)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, 5)
    .map((c) => ({ name: c.name, deuda: -c.balance }));

  return {
    totalVendido, cantidadRemitos, ingresadoCaja, saldoDeudorTotal,
    contadoTotal, cuentaTotal, pctContado, pctCuenta,
    chartData, useMonths, topByQty, topByMonto, topByCompra, topByDeuda
  };
}

function renderRankList(id, items, getName, getValue, valueClass) {
  const el = $(id);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<p class="muted">Sin datos en este período.</p>`;
    return;
  }
  el.innerHTML = items.map((item) => `
    <div class="rank-row">
      <span class="rank-name">${escapeHtml(getName(item))}</span>
      <span class="rank-value ${valueClass}">${getValue(item)}</span>
    </div>
  `).join("");
}

function renderAnalytics() {
  const section = document.getElementById("analiticas");
  if (!section || !section.classList.contains("active")) return;

  const a = computeAnalytics(analyticsPeriod);

  const kpiTotalVendido = document.getElementById("kpiTotalVendido");
  if (kpiTotalVendido) kpiTotalVendido.textContent = money(a.totalVendido);
  const kpiRemitos = document.getElementById("kpiRemitos");
  if (kpiRemitos) kpiRemitos.textContent = a.cantidadRemitos;
  const kpiIngresado = document.getElementById("kpiIngresado");
  if (kpiIngresado) kpiIngresado.textContent = money(a.ingresadoCaja);
  const kpiSaldoDeudor = document.getElementById("kpiSaldoDeudor");
  if (kpiSaldoDeudor) kpiSaldoDeudor.textContent = money(a.saldoDeudorTotal);

  const barContado = document.getElementById("barContado");
  const barContadoLabel = document.getElementById("barContadoLabel");
  const barCuenta = document.getElementById("barCuenta");
  const barCuentaLabel = document.getElementById("barCuentaLabel");
  if (barContado) barContado.style.width = `${a.pctContado.toFixed(1)}%`;
  if (barContadoLabel) barContadoLabel.textContent = `${Math.round(a.pctContado)}% · ${money(a.contadoTotal)}`;
  if (barCuenta) barCuenta.style.width = `${a.pctCuenta.toFixed(1)}%`;
  if (barCuentaLabel) barCuentaLabel.textContent = `${Math.round(a.pctCuenta)}% · ${money(a.cuentaTotal)}`;

  const chartTitle = document.getElementById("chartTitle");
  if (chartTitle) chartTitle.textContent = a.useMonths ? "Ventas por mes" : "Ventas por día";

  const chartEmpty = document.getElementById("chartEmpty");
  const chartCanvas = document.getElementById("analyticsChartCanvas");
  if (chartCanvas) {
    if (a.chartData.data.length === 0) {
      chartCanvas.style.display = "none";
      if (chartEmpty) chartEmpty.style.display = "";
    } else {
      chartCanvas.style.display = "";
      if (chartEmpty) chartEmpty.style.display = "none";
      if (analyticsChart) analyticsChart.destroy();
      analyticsChart = new Chart(chartCanvas, {
        type: "bar",
        data: {
          labels: a.chartData.labels,
          datasets: [{
            data: a.chartData.data,
            backgroundColor: "#0f766e",
            borderRadius: 4,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => money(ctx.parsed.y) }
            }
          },
          scales: {
            y: {
              ticks: {
                callback: (v) => {
                  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
                  return `$${v}`;
                }
              }
            }
          }
        }
      });
    }
  }

  renderRankList("#topProductosCantidad", a.topByQty, ([name]) => name, ([, v]) => `${v} u.`, "amount-credit");
  renderRankList("#topProductosMonto", a.topByMonto, ([name]) => name, ([, v]) => money(v), "rank-accent");
  renderRankList("#topClientesCompra", a.topByCompra, (c) => c.name, (c) => money(c.total), "amount-credit");
  renderRankList("#topClientesDeuda", a.topByDeuda, (c) => c.name, (c) => money(c.deuda), "amount-debit");
}

function init() {
  $("#saleDate").value = today();
  $("#paymentDate").value = today();
  if ($("#moduleMenuButton")) $(".mobile-module-menu")?.setAttribute("data-view", "venta");
  bindEvents();
  render();
}

export async function initBiciferApp() {
  if (initialized) return;
  initialized = true;
  registerServiceWorker();
  bindConnectivityEvents();
  supabase = createSupabaseBrowserClient();
  state = await loadState();
  currentReceipt = null;
  editingReceiptId = null;
  editingCustomerId = null;
  editingProductCode = null;
  init();
}

