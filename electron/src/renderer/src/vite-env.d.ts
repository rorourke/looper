/// <reference types="vite/client" />

import type { LooperApi } from "../../preload";

declare global {
  interface Window {
    looper: LooperApi;
  }
}
