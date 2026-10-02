declare const __APP_VERSION__: string | undefined;

/** The deployed commit, set at build time; "dev" in local runs and tests. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
