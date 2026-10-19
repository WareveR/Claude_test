import { createContext, useContext } from "react";
import type { Language } from "../core/languages";
import type { Account, Device, Family } from "./api";

export type SignedIn = { family: Family; account: Account; device: Device; language: Language };

export const SignedInContext = createContext<SignedIn | null>(null);

/** The Family, the signed-in Account and this Signed-in Device, available behind sign-in. */
export function useSignedIn(): SignedIn {
  const value = useContext(SignedInContext);
  if (!value) throw new Error("useSignedIn outside the signed-in app");
  return value;
}
