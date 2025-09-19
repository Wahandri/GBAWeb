// @ts-nocheck
import GBAPlayer from "../components/GBAPlayer";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-4xl px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 drop-shadow-glow">
            GBAWeb
          </h1>
          <p className="mt-3 text-base text-slate-400">
            Emulador de Game Boy Advance en el navegador con guardados
            persistentes.
          </p>
        </header>
        <GBAPlayer />
      </div>
    </main>
  );
}
