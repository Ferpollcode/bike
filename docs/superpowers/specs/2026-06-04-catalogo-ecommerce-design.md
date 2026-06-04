# Catálogo Ecommerce — Design Spec
**Fecha:** 2026-06-04  
**Rama:** `feature/catalogo-ecommerce`  
**Estado:** Aprobado

---

## Contexto

La app actual es un sistema de gestión de comprobantes para BIKE STORE MDZ: productos, clientes, cuentas corrientes, analíticas y generación de PDF/WhatsApp. Se agrega un módulo de catálogo tipo tienda donde tanto el dueño como los clientes pueden navegar productos, armar un carrito y generar un comprobante en PDF para compartir por WhatsApp. No hay venta online ni cobro digital.

---

## Arquitectura general

**Opción elegida: Catálogo nuevo + sistema actual intacto (Opción B)**

- Se agrega un tab "Catálogo" al sistema existente.
- El tab "Venta" se mantiene para uso del dueño (entrada manual de ítems sin código de producto).
- El acceso está controlado por rol: el dueño ve todo, el cliente solo ve el catálogo.
- Se trabaja en la rama `feature/catalogo-ecommerce` sin afectar el deploy de `master` en Vercel.

---

## Autenticación y roles

### Pantalla de login
- Pantalla inicial antes de entrar al sistema.
- Campos: usuario y contraseña.
- Sin registro público — los clientes son creados por el dueño desde el panel de Clientes.
- Sesión persistente en localStorage para ambos roles (no hay que volver a loguearse por dispositivo).

### Rol: Dueño
- Credenciales configuradas en el tab "Ajustes" (usuario y contraseña del negocio).
- Acceso completo: todos los tabs actuales + tab "Catálogo".
- Sesión persistente.

### Rol: Cliente
- El dueño asigna usuario y contraseña a cada cliente desde el panel de Clientes (campos nuevos en el modelo de cliente).
- Acceso restringido: solo ve el tab "Catálogo".
- Al ingresar queda pre-identificado en el formulario del carrito.
- Sesión persistente en localStorage.

---

## Módulo Catálogo

### Layout desktop
- Dos columnas: grilla de productos a la izquierda (~70% del ancho), carrito fijo a la derecha (~30%).
- Buscador en la parte superior de la grilla, filtra por nombre o código.

### Layout mobile
- Una sola columna. Grilla de 2 productos por fila.
- Carrito oculto por defecto.
- Botón flotante en la esquina inferior derecha con badge de cantidad de ítems en el carrito.
- Al tocar el botón flotante se abre un bottom sheet con el resumen del carrito.

### Cards de producto
Cada card muestra:
- Imagen placeholder (ícono genérico, sin fotos por ahora — se agregará imagen más adelante).
- Nombre del producto.
- Código (SKU).
- Precio.
- Control de cantidad: botón `−`, input numérico, botón `+`.
- Botón "Agregar al carrito".

### Carrito (panel derecho / bottom sheet)
- Lista de ítems agregados: nombre, cantidad editable, subtotal por ítem.
- Botón para eliminar cada ítem.
- Total general al pie.
- Botón "Generar comprobante" que abre un modal de confirmación.

### Modal de confirmación (checkout)
Campos a completar antes de generar el PDF:
- Cliente (pre-seleccionado si es un cliente logueado).
- Fecha.
- Condición de pago (Cuenta corriente / Contado).

Al confirmar:
- Se genera el PDF con el mismo sistema actual.
- Se ofrece compartir por WhatsApp (mismo flujo actual).
- El comprobante queda guardado en el historial.

---

## Cambios en modelos de datos

### Cliente (ampliación)
Se agregan dos campos opcionales:
```
usuario: string   // nombre de usuario para login
password: string  // contraseña (texto plano por ahora, sin datos sensibles)
```

### Settings (ampliación)
Se agregan credenciales del dueño:
```
ownerUsername: string
ownerPassword: string
```

### Estado de sesión (localStorage, no en Supabase)
```
session: {
  role: "owner" | "customer",
  customerId: string | null   // solo si role === "customer"
}
```

---

## Lo que NO cambia

- Tabs actuales: Venta, Clientes, Productos, Cuentas, Comprobantes, Ajustes, Analíticas.
- Generación de PDF y envío por WhatsApp.
- Sincronización con Supabase.
- Estilos visuales actuales (colores, tipografía, componentes).

---

## Fuera de alcance (por ahora)

- Fotos reales de productos.
- Stock por producto.
- Pagos online.
- Registro de clientes desde la app pública.
- Recuperación de contraseña.
