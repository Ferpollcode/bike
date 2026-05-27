"use client";

import { useEffect } from "react";
import { initBiciferApp } from "./bicifer-app";

const appMarkup = `
  <header class="app-header">
    <div>
      <p class="eyebrow">Venta movil</p>
      <h1>BiciFer Remitos</h1>
    </div>
    <button class="icon-button" id="backupBtn" type="button" title="Exportar respaldo">Respaldar</button>
  </header>

  <main class="app-shell">
    <nav class="tabs" aria-label="Secciones">
      <button class="tab active" data-view="venta" type="button">Venta</button>
      <button class="tab" data-view="clientes" type="button">Clientes</button>
      <button class="tab" data-view="productos" type="button">Productos</button>
      <button class="tab" data-view="cuentas" type="button">Cuentas</button>
      <button class="tab" data-view="remitos" type="button">Remitos</button>
      <button class="tab" data-view="ajustes" type="button">Ajustes</button>
    </nav>

    <section class="view active" id="venta">
      <div class="panel">
        <div class="section-title">
          <h2>Nuevo remito</h2>
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
        <label>Buscar producto cargado<input id="productPicker" list="productsDatalist" type="search" placeholder="Codigo o descripcion" /></label>
        <datalist id="productsDatalist"></datalist>
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
          <button class="primary full" type="submit">Guardar cliente</button>
        </form>
      </div>
      <div class="list" id="customersList"></div>
    </section>

    <section class="view" id="productos">
      <div class="panel">
        <h2>Carga masiva de productos</h2>
        <p class="muted">Cargar una planilla de Excel .xlsx. Encabezados requeridos: codigo, descripcion, precio.</p>
        <div class="sample-format">
          <code>codigo | descripcion | precio</code>
          <code>FER001 | Martillo cabo madera | 4500</code>
          <code>BIC010 | Camara rodado 29 | 3800</code>
        </div>
        <label class="file-button full">Importar Excel<input id="importProducts" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" type="file" /></label>
      </div>
      <div class="panel">
        <div class="section-title">
          <h2>Productos</h2>
          <button id="clearProducts" type="button">Vaciar</button>
        </div>
        <input id="productSearch" type="search" placeholder="Buscar producto" />
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
        <h2>Remitos guardados</h2>
        <input id="receiptSearch" type="search" placeholder="Buscar por cliente o numero" />
      </div>
      <div class="list" id="receiptsList"></div>
    </section>

    <section class="view" id="ajustes">
      <div class="panel">
        <h2>Datos del negocio</h2>
        <form id="settingsForm">
          <label>Nombre del negocio<input id="bizName" type="text" /></label>
          <label>Telefono<input id="bizPhone" type="text" /></label>
          <label>Direccion<input id="bizAddress" type="text" /></label>
          <label>Texto al pie<input id="bizFooter" type="text" /></label>
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
`;

export default function HomePage() {
  useEffect(() => {
    initBiciferApp();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: appMarkup }} />;
}
