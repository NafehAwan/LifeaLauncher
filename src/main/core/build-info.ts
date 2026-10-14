/** Values baked in at build time by Vite `define` (see vite.config.ts). Undefined in unit tests. */
declare const __LIFEA_MSA_CLIENT_ID__: string | undefined;
declare const __LIFEA_BACKEND_URL__: string | undefined;

export const BUILD_MSA_CLIENT_ID = typeof __LIFEA_MSA_CLIENT_ID__ === 'string' ? __LIFEA_MSA_CLIENT_ID__ : '';
export const BUILD_BACKEND_URL = typeof __LIFEA_BACKEND_URL__ === 'string' ? __LIFEA_BACKEND_URL__ : '';
