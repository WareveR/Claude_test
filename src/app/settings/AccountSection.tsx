import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { Field } from "../screens/form";

/** The signed-in Account: its email, its role and which Person it is. */
export function AccountSection() {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const persons = usePersons();
  const queryClient = useQueryClient();
  const choose = useMutation({
    mutationFn: (personId: string) => api("/account/person", { method: "PUT", body: { personId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  const active = persons.data?.filter((p) => !p.archived || p.id === account.personId) ?? [];
  const mine = persons.data?.find((p) => p.id === account.personId);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("account.title")}</h2>
      <p>
        {account.email} · {t(`account.roles.${account.role}`)}
      </p>
      {account.role === "member" ? (
        mine && <p>{t("account.isPerson", { name: mine.name })}</p>
      ) : (
        <Field label={t("account.person")}>
          <select
            value={account.personId ?? ""}
            onChange={(e) => choose.mutate(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2"
          >
            {account.personId === null && <option value="">{t("account.noPerson")}</option>}
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {choose.isError && <p className="text-sm text-overdue">{t("account.personTaken")}</p>}
    </section>
  );
}
