import { useQuery } from "@tanstack/react-query";
import { api, type Status } from "./api";
import { ConfirmEmailScreen } from "./screens/ConfirmEmailScreen";
import { NewSetupCodeScreen } from "./screens/NewSetupCodeScreen";
import { RecoverScreen } from "./screens/RecoverScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { SignedInApp } from "./SignedInApp";

/** Sends a browser to setup, sign-in or the calendar, depending on where it stands. */
export function App() {
  const status = useQuery({ queryKey: ["status"], queryFn: () => api<Status>("/status") });

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
