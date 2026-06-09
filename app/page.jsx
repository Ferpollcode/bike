"use client";

import { useEffect } from "react";
import { initBiciferApp } from "./bicifer-app";

const appMarkup = `
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

  <header class="app-header hidden">
    <div class="app-header-brand">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="header-bike-icon" aria-hidden="true">
        <circle cx="6" cy="17" r="4"/>
        <circle cx="18" cy="17" r="4"/>
        <path d="M6 17 L12 17 L12 10 L6 17"/>
        <line x1="12" y1="17" x2="18" y2="13"/>
        <line x1="12" y1="10" x2="18" y2="13"/>
        <line x1="10.5" y1="10" x2="13.5" y2="10"/>
        <path d="M18 13 L16.5 11.2 M18 13 L19.5 11.2"/>
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>
      </svg>
      <div>
        <p class="eyebrow">Venta movil</p>
        <h1>BIKE STORE MDZ</h1>
      </div>
    </div>
      <button id="logoutBtn" class="logout-btn" type="button">Salir</button>
  </header>

  <main class="app-shell hidden">
    <div class="mobile-module-menu" data-view="venta">
      <span>Modulo</span>
      <button id="moduleMenuButton" class="module-menu-button" type="button" aria-expanded="false" aria-controls="moduleMenuList">
        <span id="moduleMenuLabel">Venta</span>
      </button>
      <div id="moduleMenuList" class="module-menu-list hidden">
        <button data-module-option="venta" type="button">Venta</button>
        <button data-module-option="clientes" type="button">Clientes</button>
        <button data-module-option="productos" type="button">Productos</button>
        <button data-module-option="cuentas" type="button">Cuentas</button>
        <button data-module-option="remitos" type="button">Comprobantes</button>
        <button data-module-option="ajustes" type="button">Ajustes</button>
        <button data-module-option="analiticas" type="button">Analíticas</button>
        <button data-module-option="catalogo" type="button">Catálogo</button>
      </div>
    </div>

    <nav class="tabs" aria-label="Secciones">
      <button class="tab active" data-view="venta" type="button">Venta</button>
      <button class="tab" data-view="clientes" type="button">Clientes</button>
      <button class="tab" data-view="productos" type="button">Productos</button>
      <button class="tab" data-view="cuentas" type="button">Cuentas</button>
      <button class="tab" data-view="remitos" type="button">Comprobantes</button>
      <button class="tab" data-view="ajustes" type="button">Ajustes</button>
      <button class="tab" data-view="analiticas" type="button">Analíticas</button>
      <button class="tab" data-view="catalogo" type="button">Catálogo</button>
    </nav>

    <section class="view active" id="venta">
      <div class="panel">
        <div class="section-title">
          <h2>Nuevo comprobante</h2>
          <span id="nextReceiptNumber"></span>
        </div>
        <label>Cliente<select id="saleCustomer"></select></label>
        <div class="inline-actions">
          <input id="quickCustomerName" type="text" placeholder="Nuevo cliente rapido" />
          <button id="quickAddCustomer" type="button">Agregar</button>
        </div>
        <div class="grid two">
          <label>Fecha<input id="saleDate" type="date" /></label>
          <label>Condicion<select id="saleCondition"><option value="cuenta">Cuenta corriente</option><option value="contado">Contado</option></select></label>
        </div>
      </div>

      <div class="panel">
        <div class="section-title">
          <h2>Articulos</h2>
          <button id="addLine" type="button">+ Item</button>
        </div>
        <div class="field">
          <label for="productPicker">Buscar producto cargado</label>
          <div class="product-picker-wrap">
            <input id="productPicker" type="search" placeholder="Codigo o descripcion" autoComplete="off" />
            <div id="productDropdown" class="product-dropdown hidden"></div>
          </div>
        </div>
        <div id="saleLines" class="lines"></div>
        <div class="total-row"><span>Total</span><strong id="saleTotal">$0</strong></div>
      </div>

      <div class="panel">
        <label>Observaciones<textarea id="saleNotes" rows="3" placeholder="Entrega, detalle o aclaracion"></textarea></label>
        <button class="primary full" id="saveSale" type="button">Guardar y generar comprobante</button>
      </div>
    </section>

    <section class="view" id="clientes">
      <div class="panel">
        <h2>Nuevo cliente</h2>
        <form id="customerForm">
          <label>Nombre<input id="customerName" required type="text" /></label>
          <label>Telefono WhatsApp<input id="customerPhone" inputmode="tel" type="tel" value="549" placeholder="Ej: 5493511234567" /></label>
          <label>Direccion<input id="customerAddress" type="text" /></label>
            <label>Usuario (acceso catálogo)<input id="customerUsername" type="text" autocomplete="off" placeholder="Ej: cliente01" /></label>
            <label>Contraseña<input id="customerPassword" type="password" autocomplete="off" placeholder="Contraseña del cliente" /></label>
          <button class="primary full" type="submit">Guardar cliente</button>
        </form>
      </div>
      <div class="list" id="customersList"></div>
    </section>

    <section class="view" id="productos">
      <div class="panel">
        <h2>Carga masiva de productos</h2>
        <p class="muted">Cargar una planilla de Excel .xlsx. Encabezados requeridos: codigo, producto, precio. La columna categoria es opcional.</p>
        <p class="muted">Si volves a importar la lista, los productos con el mismo codigo se actualizan. Si un nombre ya existe con otro codigo, se avisa antes de confirmar.</p>
        <div class="sample-format">
          <code>codigo | producto | precio | categoria</code>
          <code>FER001 | Martillo cabo madera | 4500 | Ferretería</code>
          <code>BIC010 | Camara rodado 29 | 3800 | Bicicletas</code>
        </div>
        <label class="file-button full">Importar Excel<input id="importProducts" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" type="file" /></label>
        <div id="productImportPreview" class="import-preview hidden">
          <div class="section-title">
            <h3>Revision de importacion</h3>
            <span id="productImportSummary" class="pill"></span>
          </div>
          <p id="productImportStats" class="muted"></p>
          <div id="productImportSample" class="import-sample"></div>
          <div id="productImportWarnings" class="import-warnings muted"></div>
          <div class="inline-actions">
            <button id="cancelProductImport" type="button">Cancelar</button>
            <button class="primary" id="confirmProductImport" type="button">Confirmar importacion</button>
          </div>
        </div>
      </div>
      <div class="panel hidden" id="productEditPanel">
        <div class="section-title">
          <h2>Editar producto</h2>
          <button type="button" id="cancelProductEdit">Cancelar</button>
        </div>
        <form id="productEditForm">
          <div class="grid two">
            <label>Código<input id="editProductCode" type="text" /></label>
            <label>Precio<input id="editProductPrice" inputmode="numeric" min="0" step="1" type="number" /></label>
          </div>
          <label>Descripción<input id="editProductDescription" type="text" /></label>
          <label>Categoría
            <input id="editProductCategory" type="text" list="categoryOptions" placeholder="Ej: Bicicletas" />
            <datalist id="categoryOptions"></datalist>
          </label>
          <button class="primary full" type="submit">Guardar cambios</button>
        </form>
      </div>
      <div class="panel">
        <div class="section-title">
          <h2>Productos</h2>
          <button id="clearProducts" type="button" class="danger-btn">Vaciar</button>
        </div>
        <input id="productSearch" type="search" placeholder="Buscar producto" style="margin-top: 10px" />
      </div>
      <div class="list" id="productsList"></div>
    </section>

    <section class="view" id="cuentas">
      <div class="panel">
        <h2>Cuenta corriente</h2>
        <label>Cliente<select id="accountCustomer"></select></label>
        <div class="balance-box"><span>Saldo actual</span><strong id="accountBalance">$0</strong></div>
        <button class="primary full" id="shareAccountPdf" type="button">Enviar cuenta PDF por WhatsApp</button>
      </div>
      <div class="panel">
        <h2>Asentar pago</h2>
        <div class="grid two">
          <label>Fecha<input id="paymentDate" type="date" /></label>
          <label>Importe<input id="paymentAmount" inputmode="decimal" min="0" step="0.01" type="number" /></label>
        </div>
        <label>Detalle<input id="paymentNote" type="text" placeholder="Efectivo, transferencia..." /></label>
        <button class="primary full" id="savePayment" type="button">Guardar pago</button>
      </div>
      <div class="list compact" id="accountLedger"></div>
    </section>

    <section class="view" id="remitos">
      <div class="panel">
        <h2>Comprobantes guardados</h2>
        <input id="receiptSearch" type="search" placeholder="Buscar por cliente o numero" />
      </div>
      <div class="list" id="receiptsList"></div>
    </section>

    <section class="view" id="analiticas">
      <div class="panel">
        <h2>Analíticas</h2>
        <div class="period-filters">
          <button class="period-btn active" data-period="mes" type="button">Este mes</button>
          <button class="period-btn" data-period="30d" type="button">Últ. 30 días</button>
          <button class="period-btn" data-period="anio" type="button">Este año</button>
          <button class="period-btn" data-period="todo" type="button">Todo</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="panel kpi-card">
          <div class="kpi-label">Total vendido</div>
          <div class="kpi-value" id="kpiTotalVendido">$0</div>
        </div>
        <div class="panel kpi-card">
          <div class="kpi-label">Comprobantes emitidos</div>
          <div class="kpi-value" id="kpiRemitos">0</div>
        </div>
        <div class="panel kpi-card">
          <div class="kpi-label">Ingresado en caja</div>
          <div class="kpi-value" id="kpiIngresado">$0</div>
          <div class="kpi-sub">contado + pagos cobrados</div>
        </div>
        <div class="panel kpi-card">
          <div class="kpi-label">Saldo deudor total</div>
          <div class="kpi-value kpi-danger" id="kpiSaldoDeudor">$0</div>
          <div class="kpi-sub">todos los clientes</div>
        </div>
      </div>

      <div class="panel">
        <h2>Condición de venta</h2>
        <div class="analytics-bar-row">
          <div class="analytics-bar-label">
            <span>Contado</span>
            <span id="barContadoLabel" class="amount-credit">0%</span>
          </div>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill analytics-bar-primary" id="barContado" style="width:0%"></div>
          </div>
        </div>
        <div class="analytics-bar-row">
          <div class="analytics-bar-label">
            <span>Cuenta corriente</span>
            <span id="barCuentaLabel" class="amount-debit">0%</span>
          </div>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill analytics-bar-danger" id="barCuenta" style="width:0%"></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <h2 id="chartTitle">Ventas por día</h2>
        <canvas id="analyticsChartCanvas"></canvas>
        <p class="muted" id="chartEmpty" style="display:none;text-align:center;padding:16px 0">Sin ventas en este período.</p>
      </div>

      <div class="grid two">
        <div class="panel">
          <h2>Top por cantidad</h2>
          <div id="topProductosCantidad"></div>
        </div>
        <div class="panel">
          <h2>Top por monto</h2>
          <div id="topProductosMonto"></div>
        </div>
      </div>

      <div class="grid two">
        <div class="panel">
          <h2>Más compraron</h2>
          <div id="topClientesCompra"></div>
        </div>
        <div class="panel">
          <h2>Mayor deuda</h2>
          <div id="topClientesDeuda"></div>
        </div>
      </div>
    </section>

    <section class="view" id="catalogo">
      <div class="catalog-layout">
        <div class="catalog-main">
          <div class="catalog-controls">
            <input id="catalogSearch" type="search" placeholder="Buscar por nombre o código..." class="catalog-search" />
            <select id="catalogSort" class="catalog-sort">
              <option value="alpha">A → Z</option>
              <option value="alpha-desc">Z → A</option>
              <option value="price-asc">Precio ↑</option>
              <option value="price-desc">Precio ↓</option>
              <option value="popular">Más vendidos</option>
            </select>
          </div>
          <div id="catalogCategories" class="catalog-categories"></div>
          <div id="catalogGrid" class="catalog-grid"></div>
          <div id="catalogPagination" class="catalog-pagination"></div>
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
        <div class="cart-bottom-sheet-header">
          <h2 class="cart-title">Carrito</h2>
          <button id="closeCartSheet" class="cart-close-btn" type="button" aria-label="Cerrar carrito">✕</button>
        </div>
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

    <section class="view" id="ajustes">
      <div class="panel">
        <h2>Datos del negocio</h2>
        <form id="settingsForm">
          <label>Nombre del negocio<input id="bizName" type="text" /></label>
          <label>Telefono<input id="bizPhone" type="text" /></label>
          <label>Direccion<input id="bizAddress" type="text" /></label>
          <label>Texto al pie<input id="bizFooter" type="text" /></label>
            <h3 style="margin:16px 0 8px;font-size:15px">Acceso del dueño</h3>
            <label>Usuario<input id="ownerUsername" type="text" autocomplete="off" placeholder="Usuario para ingresar" /></label>
            <label>Contraseña<input id="ownerPassword" type="password" autocomplete="off" placeholder="Contraseña" /></label>
          <button class="primary full" type="submit">Guardar ajustes</button>
        </form>
      </div>
      <div class="panel">
        <h2>Respaldo</h2>
        <p class="muted">Exporta una copia JSON para guardar en Drive, WhatsApp o una PC. Tambien podes importar una copia anterior.</p>
        <div class="inline-actions">
          <button id="exportData" type="button">Exportar</button>
          <label class="file-button">Importar<input id="importData" accept="application/json" type="file" /></label>
        </div>
      </div>
    </section>
  </main>

  <div class="modal hidden" id="receiptModal" role="dialog" aria-modal="true">
    <div class="modal-card">
      <div class="modal-actions no-print">
        <button id="closeReceipt" type="button">Cerrar</button>
        <button id="editReceipt" type="button">Editar</button>
        <button id="deleteReceipt" type="button">Borrar</button>
        <button id="printReceipt" type="button">Imprimir</button>
        <button id="downloadPdf" type="button">PDF</button>
        <button class="primary" id="whatsappReceipt" type="button">WhatsApp</button>
      </div>
      <article id="receiptPreview" class="receipt"></article>
    </div>
  </div>

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
`;

export default function HomePage() {
  useEffect(() => {
    initBiciferApp();
  }, []);

  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: appMarkup }} />;
}

