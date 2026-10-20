import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, type Status } from "./api";
import { wipeOfflineCopy } from "./offline/persist";
import { applyUpdateWhileSignedOut, useUpdateWaiting } from "./offline/service-worker";
import { ConfirmEmailScreen } from "./screens/ConfirmEmailScreen";
import { InviteScreen } from "./screens/InviteScreen";
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
  // Nor does it keep an old version of the app, whose sign-in screen may no longer fit.
  const updateWaiting = useUpdateWaiting();
  useEffect(() => {
    if (signedOut) applyUpdateWhileSignedOut();
  }, [signedOut, updateWaiting]);

  const token = new URLSearchParams(window.location.search).get("token");
  const path = window.location.pathname;
  if (path === "/recover" && token) return <RecoverScreen token={token} />;
  if (path === "/confirm-email" && token) return <ConfirmEmailScreen token={token} />;
  if (path === "/invite" && token) return <InviteScreen token={token} />;

  if (!status.data) return null;
  if (status.data.familyExists && status.data.newSetupCode) return <NewSetupCodeScreen />;
  if (!status.data.familyExists) return <SetupScreen />;
  const { family, account, device } = status.data;
  if (!status.data.signedIn || !family || !account || !device) return <SignInScreen />;
  return <SignedInApp family={family} account={account} device={device} />;
}
