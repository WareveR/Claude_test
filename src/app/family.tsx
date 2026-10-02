import { createContext, useContext } from "react";
import type { Language } from "../core/languages";
import type { Device, Family } from "./api";

export type SignedIn = { family: Family; device: Device; language: Language };

export const SignedInContext = createContext<SignedIn | null>(null);

/** The Family and this Signed-in Device, available everywhere behind sign-in. */
export function useSignedIn(): SignedIn {
  const value = useContext(SignedInContext);
  if (!value) throw new Error("useSignedIn outside the signed-in app");
  return value;
}
