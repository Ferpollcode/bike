import "./globals.css";

export const metadata = {
  title: "BIKE STORE MDZ",
  description: "Gestion de remitos, clientes, productos y cuentas corrientes"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

