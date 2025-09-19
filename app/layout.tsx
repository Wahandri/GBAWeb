// @ts-nocheck
import "./globals.css";

export const metadata = {
  title: "GBAWeb",
  description: "Emulador de Game Boy Advance para el navegador",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
