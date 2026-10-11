declare const __APP_VERSION__: string | undefined;

/** Like "v1.4.2 (abc1234)", set at build time from main's history; "dev" in local runs and tests. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
