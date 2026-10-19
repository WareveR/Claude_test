import type { Account } from "./auth/account";
import type { Device } from "./auth/session";
import type { Db } from "./db";

export type AppEnv = {
  Bindings: Env;
  Variables: { db: Db; now: Date; device: Device; account: Account };
};
