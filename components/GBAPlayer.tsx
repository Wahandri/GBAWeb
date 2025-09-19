"use client";
// @ts-nocheck

import { useCallback, useEffect, useRef, useState } from "react";
import { getSave, setSave } from "../lib/db";
import { computeSHA256 } from "../lib/hash";

const AUTOSAVE_INTERVAL = 15000;
const ROM_DIRECTORY = "/roms";
const SAVE_DIRECTORY = "/saves";

function ensureDirectory(module, path) {
  if (!module?.FS) return;
  const { FS } = module;
  if (FS.mkdirTree) {
    try {
      FS.mkdirTree(path);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        console.warn("No se pudo crear el directorio", path, error);
      }
    }
  }
  const segments = path.split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    try {
      FS.mkdir(current);
    } catch (error) {
      if (error?.code !== "EEXIST") {
        console.warn("No se pudo crear el directorio", current, error);
      }
    }
  }
}

async function loadMgbaModule(canvas) {
  const imported = await import("@thenick775/mgba-wasm");
  const factory = imported?.default ?? imported;
  const moduleConfig = {
    canvas,
    locateFile: (path) => path,
    print: (text) => console.log(`[mGBA] ${text}`),
    printErr: (text) => console.error(`[mGBA] ${text}`),
  };

  let instance =
    typeof factory === "function" ? factory(moduleConfig) : factory(moduleConfig);

  if (instance && typeof instance.then === "function") {
    instance = await instance;
  }

  if (instance?.ready && typeof instance.ready.then === "function") {
    await instance.ready;
  }

  if (instance?.Module) {
    instance = instance.Module;
  }

  if (instance?.instance) {
    instance = instance.instance;
  }

  if (instance && typeof instance.then === "function") {
    instance = await instance;
  }

  if (instance && canvas && !instance.canvas) {
    instance.canvas = canvas;
  }

  if (typeof instance?.setCanvas === "function" && canvas) {
    instance.setCanvas(canvas);
  }

  if (typeof instance?.initialize === "function") {
    const maybePromise = instance.initialize();
    if (maybePromise?.then) {
      await maybePromise;
    }
  }

  return instance;
}

function sliceToArrayBuffer(data) {
  if (!data) return null;
  if (data instanceof ArrayBuffer) {
    return data.slice(0);
  }
  if (ArrayBuffer.isView(data)) {
    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return view.slice().buffer;
  }
  return null;
}

export default function GBAPlayer() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const moduleRef = useRef(null);
  const autosaveRef = useRef(null);
  const romDataRef = useRef(null);
  const romHashRef = useRef("");
  const romNameRef = useRef("");

  const [status, setStatus] = useState("Sube un ROM .gba para comenzar.");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [romInfo, setRomInfo] = useState({ name: "", hash: "" });

  const stopAutosave = useCallback(() => {
    if (autosaveRef.current) {
      clearInterval(autosaveRef.current);
      autosaveRef.current = null;
    }
  }, []);

  const saveSnapshot = useCallback(
    async (showMessage = true) => {
      const module = moduleRef.current;
      const hash = romHashRef.current;
      if (!module || !hash) {
        if (showMessage) {
          setStatus("Carga un ROM antes de guardar la partida.");
        }
        return;
      }
      try {
        const savePath = `${SAVE_DIRECTORY}/${hash}.sav`;
        const saveData = module.FS?.readFile?.(savePath);
        if (!saveData) {
          if (showMessage) {
            setStatus("La partida todavía no generó un archivo de guardado.");
          }
          return;
        }
        const buffer = sliceToArrayBuffer(saveData);
        if (!buffer) {
          if (showMessage) {
            setStatus("No se pudo serializar el guardado actual.");
          }
          return;
        }
        await setSave(hash, buffer);
        setStatus(showMessage ? "Partida guardada." : "Autoguardado completado.");
      } catch (error) {
        console.error("Error al guardar la partida", error);
        if (showMessage) {
          setStatus("No se pudo guardar la partida.");
        }
      }
    },
    []
  );

  const startAutosave = useCallback(() => {
    stopAutosave();
    autosaveRef.current = setInterval(() => {
      saveSnapshot(false);
    }, AUTOSAVE_INTERVAL);
  }, [saveSnapshot, stopAutosave]);

  const bootRom = useCallback(
    async (romBuffer, hash, name, options = {}) => {
      if (!romBuffer || !hash) return;
      if (!canvasRef.current) {
        setStatus("El canvas aún no está listo.");
        return;
      }

      setStatus("Inicializando mGBA...");
      stopAutosave();

      if (!options.reuseModule && moduleRef.current) {
        try {
          moduleRef.current.pauseMainLoop?.();
          moduleRef.current.exit?.(0);
          moduleRef.current.quit?.();
        } catch (error) {
          console.warn("No se pudo detener el emulador previo", error);
        }
        moduleRef.current = null;
      }

      let moduleInstance = moduleRef.current;
      if (!moduleInstance || !options.reuseModule) {
        moduleInstance = await loadMgbaModule(canvasRef.current);
        moduleRef.current = moduleInstance;
      }

      if (!moduleInstance || !moduleInstance.FS) {
        setStatus("No se pudo cargar el núcleo de mGBA.");
        return;
      }

      ensureDirectory(moduleInstance, ROM_DIRECTORY);
      ensureDirectory(moduleInstance, SAVE_DIRECTORY);

      const romPath = `${ROM_DIRECTORY}/${hash}.gba`;
      const savePath = `${SAVE_DIRECTORY}/${hash}.sav`;

      try {
        if (moduleInstance.FS.analyzePath?.(romPath)?.exists) {
          moduleInstance.FS.unlink(romPath);
        }
      } catch (error) {
        // Ignorar si el archivo no existe
      }

      moduleInstance.FS.writeFile(romPath, new Uint8Array(romBuffer));

      let existingSave = null;
      if (!options.skipSaveLookup) {
        try {
          existingSave = await getSave(hash);
        } catch (error) {
          console.warn("No se pudo leer el guardado desde IndexedDB", error);
        }
        if (existingSave) {
          moduleInstance.FS.writeFile(savePath, new Uint8Array(existingSave));
        }
      }

      romDataRef.current = romBuffer;
      romHashRef.current = hash;
      romNameRef.current = name;
      setRomInfo({ name, hash });

      try {
        if (typeof moduleInstance.loadRom === "function") {
          const result = moduleInstance.loadRom(new Uint8Array(romBuffer), {
            path: romPath,
            canvas: canvasRef.current,
          });
          if (result?.then) {
            await result;
          }
        } else if (typeof moduleInstance.loadROM === "function") {
          const result = moduleInstance.loadROM(new Uint8Array(romBuffer), romPath);
          if (result?.then) {
            await result;
          }
        } else if (typeof moduleInstance.open === "function") {
          const result = moduleInstance.open(romPath);
          if (result?.then) {
            await result;
          }
        } else if (typeof moduleInstance.callMain === "function") {
          moduleInstance.callMain([romPath]);
        } else if (typeof moduleInstance.run === "function") {
          moduleInstance.run();
        }
      } catch (error) {
        console.error("Error al iniciar el ROM", error);
        setStatus("No se pudo iniciar el ROM.");
        return;
      }

      setIsRunning(true);
      setIsPaused(false);
      setStatus(
        existingSave ? "ROM cargado con guardado previo." : "ROM cargado. ¡Disfruta!"
      );
      startAutosave();
    },
    [startAutosave, stopAutosave]
  );

  const handleRomChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      event.target.value = "";
      setStatus("Procesando ROM...");
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hash = await computeSHA256(arrayBuffer);
        await bootRom(arrayBuffer, hash, file.name, { reuseModule: false });
      } catch (error) {
        console.error("Error al cargar el ROM", error);
        setStatus("No se pudo cargar el ROM.");
      }
    },
    [bootRom]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleManualSave = useCallback(() => {
    saveSnapshot(true);
  }, [saveSnapshot]);

  const handleLoadFromIndexedDB = useCallback(async () => {
    const hash = romHashRef.current;
    const romBuffer = romDataRef.current;
    if (!hash || !romBuffer) {
      setStatus("Carga un ROM antes de cargar una partida.");
      return;
    }
    try {
      const saveData = await getSave(hash);
      if (!saveData) {
        setStatus("No hay una partida guardada en IndexedDB para este ROM.");
        return;
      }
      await bootRom(romBuffer, hash, romNameRef.current || "ROM", {
        skipSaveLookup: true,
        reuseModule: false,
      });
      setStatus("Partida cargada desde IndexedDB.");
    } catch (error) {
      console.error("Error al cargar la partida", error);
      setStatus("No se pudo cargar la partida.");
    }
  }, [bootRom]);

  const handlePause = useCallback(() => {
    const module = moduleRef.current;
    if (!module) {
      setStatus("No hay emulación activa.");
      return;
    }
    try {
      module.pauseMainLoop?.();
      module.setPaused?.(true);
      module.ccall?.("gba_pause", "void", []);
      setIsPaused(true);
      setStatus("Emulación en pausa.");
    } catch (error) {
      console.error("No se pudo pausar el emulador", error);
      setStatus("No se pudo pausar el emulador.");
    }
  }, []);

  const handleResume = useCallback(() => {
    const module = moduleRef.current;
    if (!module) {
      setStatus("No hay emulación activa.");
      return;
    }
    try {
      module.resumeMainLoop?.();
      module.setPaused?.(false);
      module.ccall?.("gba_resume", "void", []);
      setIsPaused(false);
      setStatus("Emulación reanudada.");
    } catch (error) {
      console.error("No se pudo reanudar el emulador", error);
      setStatus("No se pudo reanudar el emulador.");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAutosave();
      if (moduleRef.current) {
        try {
          moduleRef.current.pauseMainLoop?.();
          moduleRef.current.exit?.(0);
          moduleRef.current.quit?.();
        } catch (error) {
          console.warn("Error al cerrar el emulador", error);
        }
        moduleRef.current = null;
      }
    };
  }, [stopAutosave]);

  const romHashPreview = romInfo.hash
    ? `${romInfo.hash.slice(0, 12)}…`
    : "Sin ROM cargado";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-inner">
            <canvas
              ref={canvasRef}
              className="h-auto w-full max-w-full"
              width={480}
              height={320}
            />
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Estado: <span className="text-slate-200">{status}</span>
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <p>
              ROM: <span className="text-slate-300">{romInfo.name || "—"}</span>
            </p>
            <p>
              Hash: <span className="text-slate-300">{romHashPreview}</span>
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-4 lg:w-56">
          <button
            type="button"
            onClick={handleUploadClick}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition hover:bg-brand-600"
          >
            Subir ROM
          </button>
          <button
            type="button"
            onClick={handleManualSave}
            disabled={!isRunning}
            className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-brand-500 hover:text-white"
          >
            Guardar partida
          </button>
          <button
            type="button"
            onClick={handleLoadFromIndexedDB}
            disabled={!romInfo.hash}
            className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-brand-500 hover:text-white"
          >
            Cargar partida
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePause}
              disabled={!isRunning || isPaused}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-brand-500 hover:text-white"
            >
              Pausa
            </button>
            <button
              type="button"
              onClick={handleResume}
              disabled={!isRunning || !isPaused}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-brand-500 hover:text-white"
            >
              Reanudar
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Los guardados se almacenan automáticamente en IndexedDB cada 15
            segundos.
          </p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".gba"
        onChange={handleRomChange}
        className="hidden"
      />
    </div>
  );
}
