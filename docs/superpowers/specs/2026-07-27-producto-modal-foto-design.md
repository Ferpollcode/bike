# Modal de producto con foto — Design Spec
**Fecha:** 2026-07-27
**Rama:** `feature/catalogo-ecommerce`
**Estado:** Aprobado

---

## Contexto

Primer paso para preparar el Catálogo (ver `2026-06-04-catalogo-ecommerce-design.md`) como un ecommerce real: hoy las cards de producto muestran un ícono placeholder genérico para todos los productos (no hay fotos), y el campo "Descripción" del panel de edición es en realidad el nombre/título del producto, no una descripción larga.

Se agrega la posibilidad de cargar una foto y una descripción larga por producto, y un modal que se abre al tocar la card en el Catálogo mostrando la foto más grande, el título, el precio y la descripción (si tiene).

Alcance: **solo el tab Catálogo** (vista de cliente). El selector de productos de "Venta" no cambia.

---

## Modelo de datos

`product` suma dos campos opcionales (no rompen productos existentes, que quedan sin valor):

- `photoUrl: string | null` — URL pública en Supabase Storage.
- `longDescription: string` — texto largo opcional, default `""`. El campo `description` que ya existe hoy (título/nombre del producto) **no se toca ni se renombra** — se eligió `longDescription` justamente para no chocar con él.

Como estos campos viven en el mismo registro de producto que ya sincroniza/mergea (`mergeById` por `code`, ver fix de sincronización del 2026-07-27), no requieren cambios en la lógica de merge.

---

## Storage: Supabase Storage

Elegido sobre Vercel Blob y sobre embeber base64 en el blob de `app_state`:

- La app es 100% cliente (sin rutas de servidor propias); Supabase Storage se sube directo desde el browser con el mismo cliente `supabase-js` ya usado, sin infraestructura nueva.
- Vercel Blob requeriría una API route nueva (patrón que hoy no existe en la app) y provisionar una integración/token nuevos.
- Embeber la foto en `app_state.data` (base64) infla el JSON que ya se lee/mergea/escribe en cada sincronización entre dispositivos — justo lo que se optimizó en el fix de sync. Descartado.

**Bucket:** `product-photos`, público, políticas de insert/select para el rol `anon` (mismo modelo de confianza ya usado en `app_state`).

**Convención de nombre de archivo:** `product-photos/<code>.<ext>` — subir de nuevo para el mismo código reemplaza la foto anterior. El campo `photoUrl` guarda la URL pública completa devuelta por Storage; no depende de que el código del producto siga siendo el mismo después (si se edita el código, la foto ya subida se mantiene).

---

## Carga de foto y descripción

### Panel "Editar producto" (`#productEditPanel`)

Suma, debajo de los campos existentes (código, descripción/título, precio, categoría):

- **Descripción larga** (`longDescription`) — `<textarea>` opcional.
- **Foto** — `<input type="file" accept="image/*">`. Al seleccionar:
  1. Valida tamaño (máx. 5 MB) — si excede, alerta y no sube.
  2. Sube a `product-photos/<code>.<ext>` en Supabase Storage.
  3. Si falla la subida (red, error del bucket): alerta de error, `photoUrl` existente (si había) no se toca.
  4. Si tiene éxito: guarda la URL pública en `photoUrl` del producto, muestra una miniatura de preview en el propio panel, llama a `saveState()` y `render()`.

Aplica tanto a productos nuevos (cargados por Excel y editados después) como a productos ya existentes.

### Importación por Excel (`parseProductsFromRows` / `confirmProductImport`)

Se suma una columna opcional **`descripcion_larga`** al formato ya documentado (`codigo | producto | precio | categoria`), que mapea a `longDescription`. Si la fila no la trae o viene vacía, sigue el mismo criterio que ya usa `categoria` hoy: no pisa una descripción larga cargada a mano si el import no trae una nueva. Las fotos **no** se cargan por Excel — siempre a mano desde el panel, según lo definido con el usuario.

**Importante (corrige un bug latente):** `confirmProductImport` hoy reconstruye el producto entero a partir de la fila del Excel en cada reimportación, preservando solo `category` explícitamente. Si no se ajusta, reimportar el Excel para actualizar precios **borraría `photoUrl` y `longDescription`** de todos los productos ya cargados. El plan debe preservar ambos campos del registro existente siempre (el Excel nunca los trae), igual que ya hace con `category`.

---

## Modal de producto (Catálogo)

### Trigger

Clic en cualquier parte de la card de producto en `#catalogGrid`, **excepto** los controles de cantidad (`data-qty-dec`/`data-qty-inc`/`data-qty-input`) y el botón "Agregar"/"Actualizar" (`data-add-to-cart`), que mantienen su comportamiento actual sin abrir el modal.

### Card del catálogo (ajuste menor)

La card chica también pasa a mostrar `photoUrl` (si el producto la tiene) en vez del ícono placeholder — "que se vea más grande la foto" implica que ya se ve una versión chica en la card. Si no tiene foto, la card sigue mostrando el ícono placeholder de siempre, sin cambios.

### Contenido del modal

- Foto grande (`photoUrl` si existe; si no, el mismo ícono SVG placeholder que ya usa la card, agrandado).
- Título (nombre del producto).
- Precio.
- Descripción larga — sección completa omitida si el producto no tiene (`longDescription` vacío), no un "Sin descripción" vacío.
- Mismos controles de cantidad + botón "Agregar"/"Actualizar" que ya tiene la card, para sumar al carrito sin cerrar el modal.

### Comportamiento

Reutiliza el patrón **visual** del modal de checkout ya existente (clases `.modal` / `.modal-card`). El cierre por clic afuera y tecla Escape es una capacidad nueva — ningún modal de la app la tiene hoy, cierran solo con botón X — se agrega acá por tratarse de la experiencia de compra del cliente, donde es el gesto esperado.

---

## Casos límite

- **Falla de subida de foto:** mensaje de error, no se pisa la foto anterior.
- **Archivo > 5 MB:** rechazado en el cliente antes de subir, con aviso.
- **Borrado de producto con foto:** se intenta borrar también el archivo del bucket; si ese borrado puntual falla, no bloquea el borrado del producto (no crítico, evita basura acumulada pero no es bloqueante).
- **Cambio de código de producto:** la foto ya subida se mantiene (la URL no depende del código actual).

---

## Verificación

- `npm run build` y `npx eslint` limpios, igual que en cambios anteriores.
- Prueba manual de la subida real de foto contra un producto de **prueba**, no contra datos reales de catálogo del negocio.
- Requiere que el usuario cree el bucket `product-photos` y sus políticas en Supabase antes de probar (se entrega el SQL/pasos, mismo formato que se usó para habilitar Realtime).

---

## Fuera de alcance (explícitamente no incluido en esta vuelta)

- Selector de productos de "Venta" — no cambia.
- Carga de fotos por Excel/URL externa.
- Redimensionado/compresión de imagen del lado del cliente (más allá del límite de tamaño).
- Múltiples fotos por producto (galería) — una sola foto por ahora.
