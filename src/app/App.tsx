import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, type Status } from "./api";
import { wipeOfflineCopy } from "./offline/persist";
import { ConfirmEmailScreen } from "./screens/ConfirmEmailScreen";
import { NewSetupCodeScreen } from "./screens/NewSetupCodeScreen";
import { RecoverScreen } from "./screens/RecoverScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { SignedInApp } from "./SignedInApp";

/** Sends a browser to setup, sign-in or the calendar, depending on where it stands. */
export function App() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["status"], queryFn: () => api<Status>("/status") });
  const signedOut = status.data !== undefined && !status.data.signedIn;
  // A device that finds itself signed out keeps nothing of the calendar.
  useEffect(() => {
    if (signedOut) wipeOfflineCopy(queryClient);
  }, [signedOut, queryClient]);

  const token = new URLSearchParams(window.location.search).get("token");
  const path = window.location.pathname;
  if (path === "/recover" && token) return <RecoverScreen token={token} />;
  if (path === "/confirm-email" && token) return <ConfirmEmailScreen token={token} />;

  if (!status.data) return null;
  if (status.data.familyExists && status.data.newSetupCode) return <NewSetupCodeScreen />;
  if (!status.data.familyExists) return <SetupScreen />;
  if (!status.data.signedIn || !status.data.family || !status.data.device) return <SignInScreen />;
  return <SignedInApp family={status.data.family} device={status.data.device} />;
}
