import { useQuery } from "@tanstack/react-query";
import { api, type Status } from "./api";
import { SetupScreen } from "./screens/SetupScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { SignedInApp } from "./SignedInApp";

/** Sends a browser to setup, sign-in or the calendar, depending on where it stands. */
export function App() {
  const status = useQuery({ queryKey: ["status"], queryFn: () => api<Status>("/status") });

  if (!status.data) return null;
  if (!status.data.familyExists) return <SetupScreen />;
  if (!status.data.signedIn || !status.data.family || !status.data.device) return <SignInScreen />;
  return <SignedInApp family={status.data.family} device={status.data.device} />;
}
