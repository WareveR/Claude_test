import { addDays, daysBetween, daysInMonth, isPlainDate, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";

/**
 * A Contract: a bill or service the Family pays (electricity, internet, insurance, the gym), with
 * its provider, amount, how often and on which day it is paid, and when it renews. One paid by
 * hand brings a repeating Task to pay it; one paid by direct debit only shows as a notice.
 */
export type Contract = {
  id: string;
  name: string;
  provider: string;
  /** In cents; null when it varies or isn't known. */
  amount: number | null;
  frequency: ContractFrequency;
  payment: ContractPayment;
  /** The day of the month it is paid (1-31; a short month pays on its last day). */
  payDay: number | null;
  /** Yearly bills: the month (1-12) it is paid in. */
  payMonth: number | null;
  /** When the contract renews or ends; warned of 30 days before. */
  renewalDate: PlainDate | null;
  notes: string;
  createdAt: string;
  changedAt: string;
};

export const CONTRACT_FREQUENCIES = ["monthly", "yearly", "none"] as const;
export type ContractFrequency = (typeof CONTRACT_FREQUENCIES)[number];
export const CONTRACT_PAYMENTS = ["manual", "debit"] as const;
export type ContractPayment = (typeof CONTRACT_PAYMENTS)[number];

export type ContractInput = Omit<Contract, "id" | "createdAt" | "changedAt">;

/** How many days before a renewal the Family is warned. */
export const RENEWAL_NOTICE_DAYS = 30;
/** How many days ahead a direct debit shows as a notice. */
export const DEBIT_NOTICE_DAYS = 7;
const MAX_TEXT = 100;
const MAX_NOTES = 1000;
const MAX_AMOUNT = 100_000_00;

/** A Contract as sent by the browser, cleaned; or the first bad field. */
export function parseContract(
  body: Record<string, unknown>,
): { contract: ContractInput } | { field: string } {
  const text = (key: string, max: number) => {
    const value = body[key] ?? "";
    return typeof value === "string" && value.trim().length <= max ? value.trim() : null;
  };
  const name = text("name", MAX_TEXT);
  if (!name) return { field: "name" };
  const provider = text("provider", MAX_TEXT);
  if (provider === null) return { field: "provider" };
  const amount = body.amount ?? null;
  if (
    amount !== null &&
    (!Number.isInteger(amount) || (amount as number) < 0 || (amount as number) > MAX_AMOUNT)
  ) {
    return { field: "amount" };
  }
  const frequency = body.frequency ?? "monthly";
  if (!(CONTRACT_FREQUENCIES as readonly unknown[]).includes(frequency))
    return { field: "frequency" };
  const payment = body.payment ?? "manual";
  if (!(CONTRACT_PAYMENTS as readonly unknown[]).includes(payment)) return { field: "payment" };
  const between = (value: unknown, max: number) =>
    value === null ||
    (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max);
  const payDay = frequency === "none" ? null : (body.payDay ?? null);
  if (!between(payDay, 31)) return { field: "payDay" };
  const payMonth = frequency === "yearly" ? (body.payMonth ?? null) : null;
  if (!between(payMonth, 12)) return { field: "payMonth" };
  if (frequency === "yearly" && payDay !== null && payMonth === null) return { field: "payMonth" };
  const renewalDate = body.renewalDate ?? null;
  if (renewalDate !== null && (typeof renewalDate !== "string" || !isPlainDate(renewalDate))) {
    return { field: "renewalDate" };
  }
  const notes = text("notes", MAX_NOTES);
  if (notes === null) return { field: "notes" };
  return {
    contract: {
      name,
      provider,
      amount: amount as number | null,
      frequency: frequency as ContractFrequency,
      payment: payment as ContractPayment,
      payDay: payDay as number | null,
      payMonth: payMonth as number | null,
      renewalDate: renewalDate as PlainDate | null,
      notes,
    },
  };
}

function dateOf(year: number, month: number, day: number): PlainDate {
  const d = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The next day it is paid, today included; null when it has no pay day. */
export function nextPayment(
  contract: Pick<Contract, "frequency" | "payDay" | "payMonth">,
  today: PlainDate,
): PlainDate | null {
  const { frequency, payDay, payMonth } = contract;
  if (frequency === "none" || payDay === null) return null;
  const [y, m] = today.split("-").map(Number);
  if (frequency === "monthly") {
    const now = dateOf(y, m, payDay);
    if (now >= today) return now;
    return m === 12 ? dateOf(y + 1, 1, payDay) : dateOf(y, m + 1, payDay);
  }
  if (payMonth === null) return null;
  const now = dateOf(y, payMonth, payDay);
  return now >= today ? now : dateOf(y + 1, payMonth, payDay);
}

/** The Task that pays a Contract paid by hand: its title, first due date and repetition. */
export function paymentTask(
  contract: ContractInput,
  today: PlainDate,
  language: "pt-PT" | "en",
): { title: string; dueDate: PlainDate; repetition: Repetition } | null {
  if (contract.payment !== "manual") return null;
  const dueDate = nextPayment(contract, today);
  if (!dueDate) return null;
  const what = contract.provider ? `${contract.name} (${contract.provider})` : contract.name;
  const amount = contract.amount !== null ? ` · ${formatAmount(contract.amount, language)}` : "";
  return {
    title: `${language === "en" ? "Pay" : "Pagar"} ${what}${amount}`,
    dueDate,
    repetition: {
      frequency: contract.frequency === "yearly" ? "yearly" : "monthly",
      interval: 1,
      end: { type: "never" },
    },
  };
}

export function formatAmount(cents: number, language: string): string {
  return new Intl.NumberFormat(language === "en" ? "en-GB" : "pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** One thing to know about a Contract soon: a renewal coming, or a direct debit going out. */
export type ContractNotice = {
  contract: Contract;
  kind: "renewal" | "debit";
  date: PlainDate;
  days: number;
};

/**
 * What the Summary warns of: renewals within 30 days, and direct debits within the week. A bill
 * paid by hand has its Task instead.
 */
export function contractNotices(contracts: Contract[], today: PlainDate): ContractNotice[] {
  const out: ContractNotice[] = [];
  for (const contract of contracts) {
    const renewal = contract.renewalDate;
    if (renewal && renewal >= today && daysBetween(today, renewal) <= RENEWAL_NOTICE_DAYS) {
      out.push({ contract, kind: "renewal", date: renewal, days: daysBetween(today, renewal) });
    }
    if (contract.payment === "debit") {
      const paid = nextPayment(contract, today);
      if (paid && paid <= addDays(today, DEBIT_NOTICE_DAYS)) {
        out.push({ contract, kind: "debit", date: paid, days: daysBetween(today, paid) });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
