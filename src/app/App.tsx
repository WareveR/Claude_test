import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, type Status } from "./api";
import { SetupScreen } from "./screens/SetupScreen";
import { SignInScreen } from "./screens/SignInScreen";

export function App() {
  const status = useQuery({ queryKey: ["status"], queryFn: () => api<Status>("/status") });

  if (!status.data) return null;
  if (!status.data.familyExists) return <SetupScreen />;
  if (!status.data.signedIn) return <SignInScreen />;
  return <Home familyName={status.data.family?.name ?? ""} />;
}

/** Placeholder until the calendar views arrive. */
function Home({ familyName }: { familyName: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => api("/session", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{familyName}</h1>
      <button type="button" className="self-start underline" onClick={() => signOut.mutate()}>
        {t("signIn.signOut")}
      </button>
    </main>
  );
}
