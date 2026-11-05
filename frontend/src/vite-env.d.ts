/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Prefijo de la API. Por defecto `/api/v1`, servido por el proxy de Vite. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
