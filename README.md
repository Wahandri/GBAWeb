# GBAWeb

Base inicial de un proyecto [Next.js](https://nextjs.org/) para ejecutar juegos de Game Boy Advance directamente en el navegador utilizando el núcleo WASM de [mGBA](https://mgba.io/).

## Características

- ⚙️ **Next.js (App Router)** configurado solo con JavaScript.
- 🕹️ **Emulador mGBA** vía [`@thenick775/mgba-wasm`](https://www.npmjs.com/package/@thenick775/mgba-wasm).
- 💾 **Guardados persistentes** en IndexedDB usando [`idb`](https://github.com/jakearchibald/idb).
- 🔐 Encabezados **COOP/COEP** activos para habilitar `SharedArrayBuffer`.
- 🎨 Interfaz oscura responsiva construida con [Tailwind CSS](https://tailwindcss.com/).
- 💡 Componentes cliente listos para cargar ROMs `.gba`, guardar/cargar partidas y autosalvar cada 15 segundos.

## Requisitos

- Node.js 18 o superior.
- NPM 9+.

> **Nota:** La instalación de dependencias requiere acceso al paquete privado `@thenick775/mgba-wasm`.

## Scripts disponibles

```bash
npm run dev     # Ejecuta el entorno de desarrollo
npm run build   # Genera la build de producción
npm run start   # Levanta la build ya compilada
npm run lint    # Ejecuta ESLint
```

## Estructura relevante

```text
app/
  layout.tsx      # Layout global con estilos oscuros
  page.tsx        # Página principal que monta el reproductor GBA
components/
  GBAPlayer.tsx   # Componente cliente con canvas, controles y gestión de saves
lib/
  db.ts           # Helper para IndexedDB con idb
  hash.ts         # Utilidad para calcular SHA-256
next.config.mjs   # Configuración de headers COOP/COEP y soporte WASM
```

## Guardados y autosave

1. Al cargar una ROM se calcula un hash SHA-256 que se utiliza como clave única.
2. Antes de ejecutar el juego se busca un `.sav` en IndexedDB y se inyecta en el FS de mGBA.
3. El botón **Guardar partida** guarda el archivo `.sav` actual en IndexedDB.
4. **Cargar partida** restaura el `.sav` desde IndexedDB y reinicia el emulador con ese estado.
5. Se ejecuta un **autoguardado cada 15 segundos** mientras el emulador está activo.

¡Listo! Sube tu ROM `.gba`, guarda y recupera tus partidas sin salir del navegador.
