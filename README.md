# BiciFer Remitos

Aplicacion local para celular hecha con HTML, CSS y JavaScript puro. No usa React, frameworks, base de datos externa ni internet para guardar datos.

## Estructura

```text
bicifer-remitos/
  index.html
  assets/
    css/
      styles.css
    js/
      app.js
  README.md
```

## Como usar

1. Abrir `index.html` con Chrome, Edge o el navegador del celular.
2. Cargar clientes desde la seccion `Clientes` o agregarlos rapido desde `Venta`.
3. Crear un remito, guardar y tocar `WhatsApp` para enviar el comprobante.
4. Las ventas en `Cuenta corriente` aumentan el saldo del cliente.
5. Los pagos se cargan desde `Cuentas` y bajan el saldo.
6. Usar `Respaldar` o `Ajustes > Exportar` para guardar una copia JSON.
7. En el remito, tocar `PDF` para descargar el comprobante en formato PDF.

## Uso en iPhone

Si el iPhone muestra la app sin colores ni formato, abrir `app-iphone.html`. Ese archivo trae el HTML, CSS y JavaScript todo junto, por eso funciona mejor cuando iOS no carga bien la carpeta `assets`.

En iPhone, Chrome usa el mismo motor que Safari. Si se abre desde la app `Archivos`, puede aparecer como una vista previa llamada `index` y no cargar los estilos. En ese caso usar `app-iphone.html` o subir la carpeta completa a Drive/iCloud y abrir el archivo desde ahi.

## Carga masiva de productos desde Excel

La app importa productos desde un archivo Excel `.xlsx`.

Formato requerido:

```text
codigo | descripcion              | precio
FER001 | Martillo cabo madera      | 4500
BIC010 | Camara rodado 29          | 3800
```

Columnas:

- `codigo`: identificador unico del producto. Si se importa otra vez el mismo codigo, se actualiza.
- `descripcion`: nombre que se vera al cargar el remito.
- `precio`: precio numerico, sin simbolo `$`.

Pasos en Excel:

1. Crear una planilla con esas tres columnas exactas.
2. Guardar como `Libro de Excel (*.xlsx)`.
3. Entrar en la app a `Productos`.
4. Tocar `Importar Excel` y seleccionar el archivo.

Luego, en `Venta`, usar `Buscar producto cargado` para agregarlo rapido al remito.

Importante: el formato viejo `.xls` binario no se lee en esta app local. Si tenes un `.xls`, abrilo en Excel y guardalo como `.xlsx`.

## Datos

Los clientes, productos, remitos y movimientos quedan guardados en el navegador del dispositivo mediante `localStorage`. Si se borra el historial o los datos del navegador, se pueden perder. Conviene exportar respaldo todos los dias de trabajo.

## Ejecutar local

No requiere instalacion. Se puede abrir directamente:

```text
C:\Users\Usuario\Desktop\bicifer-remitos\index.html
```

Version recomendada para iPhone:

```text
C:\Users\Usuario\Desktop\bicifer-remitos\app-iphone.html
```

Si se quiere compartir en red local, alcanza con servir esta carpeta con cualquier servidor estatico.
