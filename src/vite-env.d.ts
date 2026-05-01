/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_PASSWORD: string
  readonly VITE_BASE_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
