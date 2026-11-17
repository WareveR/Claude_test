import { CalendarClock, Plus, Receipt } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  CONTRACT_FREQUENCIES,
  CONTRACT_PAYMENTS,
  contractNotices,
  formatAmount,
  nextPayment,
  type ContractFrequency,
  type ContractPayment,
} from "../../core/contracts";
import { formatPlainDate, todayIn } from "../../core/plain-date";
import { ApiError } from "../api";
import { useSignedIn } from "../family";
import { ErrorText, Field, TextInput } from "../screens/form";
import { useNow } from "../shell/useNow";
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from "../ui/button";
import { useContracts, useDeleteContract, useSaveContract, type Contract } from "./model";

const SELECT = "w-full rounded-md border border-line bg-surface px-3 py-2 text-base";

function useToday() {
  const { family } = useSignedIn();
  return todayIn(family.timeZone, useNow(60_000));
}

/** Settings › Family: the Contracts and bills, each opened to change it. */
export function ContractsSection() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const contracts = useContracts().data ?? [];
  const [editing, setEditing] = useState<Contract | "new" | null>(null);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="contracts-title">
      <h2 id="contracts-title" className="flex items-center gap-2 font-semibold">
        <Receipt aria-hidden size={18} />
        {t("contracts.title")}
      </h2>
      <ul className="divide-y divide-line rounded-md border border-line px-3">
        {contracts.map((contract) => {
          const paid = nextPayment(contract, today);
          const detail = [
            contract.provider,
            contract.amount !== null && formatAmount(contract.amount, i18n.language),
            paid &&
              t(`contracts.next.${contract.payment}`, {
                date: formatPlainDate(paid, i18n.language, { day: "numeric", month: "short" }),
              }),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={contract.id}>
              <button
                type="button"
                data-testid="contract"
                className="flex w-full flex-col items-start py-2 text-left"
                onClick={() => setEditing(contract)}
              >
                <span>{contract.name}</span>
                {detail && <span className="text-xs text-muted">{detail}</span>}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-3 py-2"
            onClick={() => setEditing("new")}
          >
            <Plus aria-hidden size={20} strokeWidth={1.75} />
            {t("contracts.add")}
          </button>
        </li>
      </ul>
      <p className="text-xs text-muted">{t("contracts.hint")}</p>
      {editing && (
        <ContractDialog
          contract={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

/** "12,50" or "12.5" in euros to cents; null when empty, NaN when not a number. */
function toCents(text: string): number | null {
  const clean = text.trim().replace(/\s|€/gu, "").replace(",", ".");
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

function ContractDialog({ contract, onClose }: { contract?: Contract; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const save = useSaveContract();
  const remove = useDeleteContract();
  const [form, setForm] = useState({
    name: contract?.name ?? "",
    provider: contract?.provider ?? "",
    amount: contract?.amount != null ? (contract.amount / 100).toFixed(2) : "",
    frequency: contract?.frequency ?? ("monthly" as ContractFrequency),
    payment: contract?.payment ?? ("manual" as ContractPayment),
    payDay: contract?.payDay != null ? String(contract.payDay) : "",
    payMonth: contract?.payMonth != null ? String(contract.payMonth) : "1",
    renewalDate: contract?.renewalDate ?? "",
    notes: contract?.notes ?? "",
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const bad = save.error instanceof ApiError ? save.error.body.field : undefined;
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(new Date(2026, i, 1)),
  );
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = toCents(form.amount);
          save.mutate(
            {
              id: contract?.id,
              name: form.name,
              provider: form.provider,
              amount: Number.isNaN(amount) ? -1 : amount,
              frequency: form.frequency,
              payment: form.payment,
              payDay: form.payDay ? Number(form.payDay) : null,
              payMonth: form.frequency === "yearly" ? Number(form.payMonth) : null,
              renewalDate: form.renewalDate || null,
              notes: form.notes,
            },
            { onSuccess: onClose },
          );
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {contract ? contract.name : t("contracts.add")}
        </h2>
        <Field label={t("contracts.name")}>
          <TextInput
            required
            value={form.name}
            maxLength={100}
            placeholder={t("contracts.nameHint")}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={t("contracts.provider")}>
          <TextInput
            value={form.provider}
            maxLength={100}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("contracts.amount")}>
            <TextInput
              inputMode="decimal"
              value={form.amount}
              placeholder="0,00"
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label={t("contracts.frequency")}>
            <select
              className={SELECT}
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as ContractFrequency })}
            >
              {CONTRACT_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t(`contracts.frequencies.${f}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {form.frequency !== "none" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("contracts.payDay")}>
              <TextInput
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={form.payDay}
                onChange={(e) => setForm({ ...form, payDay: e.target.value })}
              />
            </Field>
            {form.frequency === "yearly" && (
              <Field label={t("contracts.payMonth")}>
                <select
                  className={SELECT}
                  value={form.payMonth}
                  onChange={(e) => setForm({ ...form, payMonth: e.target.value })}
                >
                  {months.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">{t("contracts.payment")}</legend>
          {CONTRACT_PAYMENTS.map((p) => (
            <label key={p} className="flex items-start gap-2">
              <input
                type="radio"
                name="payment"
                className="mt-1"
                checked={form.payment === p}
                onChange={() => setForm({ ...form, payment: p })}
              />
              <span>
                {t(`contracts.payments.${p}`)}
                <span className="block text-sm text-muted">{t(`contracts.paymentHints.${p}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label={t("contracts.renewal")}>
          <TextInput
            type="date"
            value={form.renewalDate}
            onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
          />
        </Field>
        <Field label={t("contracts.notes")}>
          <textarea
            rows={2}
            value={form.notes}
            maxLength={1000}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={SELECT}
          />
        </Field>
        {save.error && (
          <ErrorText>
            {bad ? t(`contracts.bad.${bad}`, t("errors.unexpected")) : t("errors.unexpected")}
          </ErrorText>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {contract && (
            <button
              type="button"
              className={`${BUTTON_DANGER} mr-auto`}
              onClick={() => remove.mutate(contract.id, { onSuccess: onClose })}
            >
              {t("contracts.delete")}
            </button>
          )}
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="submit" className={BUTTON_PRIMARY} disabled={save.isPending}>
            {t("contracts.save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** The Summary's notices: renewals within 30 days and direct debits within the week. */
export function ContractNotices() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const notices = contractNotices(useContracts().data ?? [], today);
  if (notices.length === 0) return null;
  return (
    <section
      aria-labelledby="contract-notices-title"
      data-testid="contract-notices"
      className="mx-4 flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-sm"
    >
      <h2 id="contract-notices-title" className="flex items-center gap-2 text-xl font-bold">
        <Receipt aria-hidden size={20} />
        {t("contracts.notices")}
      </h2>
      <ul className="divide-y divide-line">
        {notices.map((n) => (
          <li key={`${n.contract.id}-${n.kind}`} className="flex items-start gap-2 py-2">
            <CalendarClock aria-hidden size={18} className="mt-0.5 shrink-0 text-muted" />
            <span>
              {t(`contracts.notice.${n.kind}`, {
                name: n.contract.name,
                date: formatPlainDate(n.date, i18n.language, { day: "numeric", month: "short" }),
                amount:
                  n.contract.amount !== null
                    ? ` · ${formatAmount(n.contract.amount, i18n.language)}`
                    : "",
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
