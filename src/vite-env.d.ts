/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_RYBBIT_SCRIPT_URL?: string
  readonly VITE_TRACKING_SCRIPT_URL?: string
  readonly VITE_RYBBIT_SITE_ID?: string
  readonly VITE_RYBBIT_API_KEY?: string
  readonly VITE_RYBBIT_TRACK_ERRORS?: string
  readonly VITE_RYBBIT_SESSION_REPLAY?: string
}

interface AppRuntimeConfig {
  CLIENT_URL?: string
  PUBLIC_ORIGIN?: string
  VITE_RYBBIT_SCRIPT_URL?: string
  VITE_TRACKING_SCRIPT_URL?: string
  VITE_RYBBIT_SITE_ID?: string
  VITE_RYBBIT_API_KEY?: string
  VITE_RYBBIT_TRACK_ERRORS?: boolean | string
  VITE_RYBBIT_SESSION_REPLAY?: boolean | string
}

interface Window {
  __APP_RUNTIME_CONFIG__?: AppRuntimeConfig
}
