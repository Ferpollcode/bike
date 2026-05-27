# BiciFer Remitos

Aplicacion Next.js para gestionar remitos, clientes, productos y cuentas corrientes desde distintos dispositivos.

La app usa Supabase como almacenamiento compartido. Si Supabase no esta configurado o no responde, conserva un respaldo local en `localStorage`.

## Requisitos

- Node.js 24 o compatible con Next 16.
- Un proyecto de Supabase.

## Instalacion

```bash
npm install
```

## Configurar Supabase

1. Crear un proyecto en Supabase.
2. Abrir el SQL Editor y ejecutar el contenido de `supabase/schema.sql`.

3. Copiar `.env.example` a `.env.local`.
4. Completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

La tabla usada es `public.app_state`. Guarda el estado completo de la aplicacion en la fila `bicifer-remitos`.

## Desarrollo

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Produccion

```bash
npm run build
npm run start
```

## Funciones principales

- Crear, editar y borrar remitos.
- Generar PDF del remito.
- Compartir PDF por WhatsApp cuando el navegador lo permite.
- Cargar, editar y borrar clientes.
- Importar productos desde Excel `.xlsx`.
- Manejar cuentas corrientes.
- Registrar pagos.
- Generar y compartir PDF de cuenta corriente.
- Exportar e importar respaldo JSON.

## Migrar datos anteriores

La version anterior guardaba todo en el navegador. Para pasar datos a Supabase:

1. Abrir la version anterior.
2. Ir a `Ajustes > Exportar`.
3. Abrir la nueva app Next.js.
4. Ir a `Ajustes > Importar`.

Al importar, la app guarda el respaldo en Supabase y queda disponible para los otros dispositivos.

## Verificacion

```bash
npm run lint
npm run build
```
