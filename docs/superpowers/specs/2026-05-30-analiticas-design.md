---
name: analiticas-design
description: Sección de analíticas para BIKE STORE MDZ — dashboard con KPIs, gráfico de ventas (Chart.js), rankings de productos y clientes, filtros por período.
metadata:
  type: project
---

# Diseño: Sección de Analíticas

## Resumen

Agregar un nuevo módulo "Analíticas" a la app de ventas/remitos. Muestra métricas clave del negocio calculadas sobre los datos locales existentes (`receipts`, `ledger`, `customers`). Funciona offline. Estilo visual integrado con el sistema de diseño actual.

---

## Estructura visual

Estilo **mixto**: KPIs numéricos destacados + barras de progreso para proporciones + listas de ranking. Mismo sistema de diseño que el resto de la app: cards blancas, borde `#dde3ea`, fondo `#f4f6f8`, teal `#0f766e` para positivos, rojo `#b42318` para deuda, ámbar `#f59e0b` para rankings por monto.

### Tab y navegación

- Se agrega `"analíticas"` como nuevo tab en el `<nav class="tabs">` del HTML.
- Se agrega la opción `data-module-option="analiticas"` en el menú móvil.
- Color del tab: naranja `#ea580c` (activo: texto blanco; inactivo: fondo `#fff3ec`, texto `#9a3412`). Es el único color cálido libre en el sistema.
- Label en `moduleLabels`: `"Analíticas"`.

### Layout de la sección (de arriba a abajo)

1. **Filtros de período** — panel con 4 botones: "Este mes" / "Últ. 30 días" / "Este año" / "Todo". El activo se pinta con el color del tab (naranja).
2. **KPIs (grilla 2×2)** — 4 tarjetas:
   - Total vendido (teal)
   - Remitos emitidos (teal)
   - Ingresado en caja: ventas al contado + pagos asentados en `ledger` (teal, subtexto muted)
   - Saldo deudor total: suma de saldos negativos de todos los clientes (rojo, subtexto muted). **Siempre global, no filtrado por período.**
3. **Condición de venta** — panel con dos barras de progreso: Contado (teal) y Cuenta corriente (rojo), cada una con porcentaje y monto.
4. **Gráfico de ventas** — Chart.js `type: 'bar'`. Barras en teal `#0f766e`. Agrupación automática: por **día** si el período ≤ 30 días; por **mes** si es "Este año" o "Todo". El título del panel indica el agrupamiento activo.
5. **Top productos (grilla 2 columnas)**:
   - Izq: ranking por **cantidad** de unidades vendidas (teal).
   - Der: ranking por **monto** generado (ámbar).
   - Mostrar top 5 de cada uno.
6. **Top clientes (grilla 2 columnas)**:
   - Izq: clientes que **más compraron** en el período (teal).
   - Der: clientes con **mayor deuda** actual (rojo, siempre global).
   - Mostrar top 5 de cada uno.

---

## Datos y cálculos

### Filtrado por período

```
receiptsInPeriod = receipts.filter(r => r.date >= startDate && r.date <= endDate)
ledgerInPeriod   = ledger.filter(e => e.date >= startDate && e.date <= endDate)
```

Períodos:
- "Este mes": del día 1 del mes actual a hoy.
- "Últ. 30 días": últimos 30 días corridos.
- "Este año": del 1 de enero del año actual a hoy.
- "Todo": sin filtro.

### KPIs

| Métrica | Cálculo |
|---|---|
| Total vendido | `sum(receipt.total)` sobre `receiptsInPeriod` |
| Remitos emitidos | `receiptsInPeriod.length` |
| Ingresado en caja | `sum(contado receipts.total)` + `sum(ledger payments.amount)` en período |
| Saldo deudor total | `sum(max(0, -getBalance(c.id)))` para todos los clientes (global) |

### Condición de venta

```
totalCuenta  = sum(receipt.total donde condition === "cuenta")
totalContado = sum(receipt.total donde condition === "contado")
pctContado   = totalContado / (totalContado + totalCuenta) * 100
```

### Gráfico de ventas

- Obtener fechas únicas del período → agrupar `receiptsInPeriod` por día o mes.
- Labels: días (`"01 may"`) o meses (`"Ene"`, `"Feb"`, …).
- Dataset: suma de `receipt.total` por grupo.
- Instancia Chart.js guardada en variable `analyticsChart`; llamar `analyticsChart.destroy()` antes de re-renderizar.

### Top productos

Recorrer `receipt.items` de `receiptsInPeriod`:
- Por cantidad: `Map<nombre, totalUnidades>` → ordenar desc → top 5.
- Por monto: `Map<nombre, totalMonto>` donde monto = `item.qty * item.price` → ordenar desc → top 5.

### Top clientes

- Más compraron: `Map<customerId, totalCompras>` de `receiptsInPeriod` → join con `customers` para nombre → top 5.
- Mayor deuda: `customers.map(c => ({ name, balance: getBalance(c.id) })).filter(b < 0).sort asc → top 5`.

---

## Implementación técnica

### Dependencia

```
npm install chart.js
```

Import en `bicifer-app.js`:
```js
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from "chart.js";
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
```
(Tree-shakeable: solo se importan los componentes usados, ~20 kb en bundle.)

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/page.jsx` | Agregar `<section id="analiticas">` con su HTML interno, tab en `<nav>`, opción en menú móvil |
| `app/globals.css` | Estilos del tab "Analíticas" (naranja), estilos de botones de período, grilla KPI |
| `app/bicifer-app.js` | Funciones `renderAnalytics()`, `computeAnalytics(period)`, `bindAnalyticsEvents()`, `analyticsChart` variable |

### Flujo de render

1. Al activar el tab "Analíticas": llamar `renderAnalytics()`.
2. Al cambiar el filtro de período: llamar `renderAnalytics()` con el período nuevo.
3. `renderAnalytics()` llama `computeAnalytics(period)` → actualiza el DOM → recrea el gráfico Chart.js.

### Sin estado persistido

El período seleccionado no se guarda en `state` ni en Supabase — es solo estado UI local de la sesión.

---

## Casos borde

- **Sin datos en el período**: KPIs en `$0` / `0`, gráfico vacío con mensaje "Sin ventas en este período", rankings vacíos.
- **Productos sin nombre**: agrupar por nombre del item tal como fue cargado en el remito (texto libre).
- **Cliente eliminado**: si `customerId` no encuentra nombre en `customers`, mostrar `"(cliente eliminado)"`.
- **Saldo deudor = 0 para todos**: bloque "Mayor deuda" muestra "Sin deudas pendientes".
