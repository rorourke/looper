import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));
const internalDebugBuild =
  process.env.MAIN_VITE_INTERNAL_DEBUG_BUILD === "true";

export default defineConfig({
  main: {
    define: {
      __LOOPER_INTERNAL_DEBUG_BUILD__: JSON.stringify(internalDebugBuild)
    },
    build: {
      rollupOptions: {
        external: ["electron", "electron-updater"],
        input: resolve(root, "src/main/index.ts")
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ["electron"],
        input: resolve(root, "src/preload/index.ts"),
        output: {
          format: "cjs"
        }
      }
    }
  },
  renderer: {
    root: resolve(root, "src/renderer"),
    resolve: {
      alias: {
        "@renderer": resolve(root, "src/renderer/src")
      }
    },
    plugins: [react()]
  }
});
