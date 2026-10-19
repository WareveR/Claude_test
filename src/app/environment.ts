declare const __TEST_SITE__: boolean | undefined;
declare const __DEV_TOOLS__: boolean | undefined;

/**
 * The test copy of the app (calendario-testes.phinest.org, docs/runbooks/testes.md), set at
 * build time; false in production.
 */
export const TEST_SITE: boolean = typeof __TEST_SITE__ === "boolean" && __TEST_SITE__;

/**
 * Tools for testing and diagnosing the app: shown on the test copy, in local runs and in the e2e
 * build, never in production.
 */
export const DEV_TOOLS: boolean =
  import.meta.env.DEV || (typeof __DEV_TOOLS__ === "boolean" ? __DEV_TOOLS__ : true);
