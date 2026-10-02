import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export function App() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      return (await res.json()) as { status: string };
    },
  });

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold">{t("app.name")}</h1>
      <p data-testid="api-status">{health.data?.status ?? "…"}</p>
    </main>
  );
}
