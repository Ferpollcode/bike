# Crear producto manual — Design Spec
**Fecha:** 2026-07-27
**Rama:** `feature/catalogo-ecommerce`
**Estado:** Aprobado

## Contexto

Hoy los productos solo se crean por importación masiva de Excel; el panel de edición (`#productEditPanel`) solo se abre desde `loadProductForEdit(code)` para un producto existente. Se agrega la posibilidad de crear un producto individual a mano, reutilizando el mismo panel en un modo "nuevo".

## Diseño

- Botón **"+ Nuevo producto"** junto a "Vaciar" en la sección Productos (`app/page.jsx`).
- Nueva función `openNewProductForm()` (`app/bicifer-app.js`): pone `editingProductCode = null`, limpia el formulario, oculta la preview de foto, cambia el título del panel a "Nuevo producto" y el botón a "Crear producto", muestra el panel.
- `loadProductForEdit` restaura el título a "Editar producto" y el botón a "Guardar cambios" (por si el panel quedó en modo "nuevo").
- `saveProductEdit` se bifurca al principio: si `editingProductCode` es `null`, valida que el código no exista ya (mismo mensaje de error que usa el cambio de código al editar), crea el producto (`photoUrl: null`, `longDescription: ""`, `updatedAt: Date.now()`), oculta el panel, guarda y renderiza. Si `editingProductCode` tiene valor, seguí con el flujo de edición actual sin cambios.
- "Cancelar" no cambia — ya resetea `editingProductCode` y oculta el panel.

## Fuera de alcance

- Cargar foto/descripción larga en el mismo alta — se hace editando el producto después, igual que con los que vienen del Excel.
