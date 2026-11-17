import { describe, expect, it } from "vitest";
import {
  contractNotices,
  nextPayment,
  parseContract,
  paymentTask,
  type Contract,
} from "./contracts";

const contract = (over: Partial<Contract>): Contract => ({
  id: "c",
  name: "Luz",
  provider: "EDP",
  amount: 4550,
  frequency: "monthly",
  payment: "manual",
  payDay: 8,
  payMonth: null,
  renewalDate: null,
  notes: "",
  createdAt: "",
  changedAt: "",
  ...over,
});

describe("Contracts", () => {
  it("are cleaned, monthly and paid by hand unless said", () => {
    expect(parseContract({ name: " Luz ", provider: "EDP", amount: 4550, payDay: 8 })).toEqual({
      contract: {
        name: "Luz",
        provider: "EDP",
        amount: 4550,
        frequency: "monthly",
        payment: "manual",
        payDay: 8,
        payMonth: null,
        renewalDate: null,
        notes: "",
      },
    });
    expect(parseContract({ name: "" })).toEqual({ field: "name" });
    expect(parseContract({ name: "x", payDay: 32 })).toEqual({ field: "payDay" });
    expect(parseContract({ name: "x", amount: 12.5 })).toEqual({ field: "amount" });
    expect(parseContract({ name: "x", frequency: "yearly", payDay: 3 })).toEqual({
      field: "payMonth",
    });
  });

  it("are paid next on their day, a short month on its last day", () => {
    expect(nextPayment(contract({}), "2026-11-08")).toBe("2026-11-08");
    expect(nextPayment(contract({}), "2026-11-09")).toBe("2026-12-08");
    expect(nextPayment(contract({ payDay: 31 }), "2026-11-17")).toBe("2026-11-30");
    expect(nextPayment(contract({ payDay: 8 }), "2026-12-20")).toBe("2027-01-08");
    const yearly = contract({ frequency: "yearly", payDay: 15, payMonth: 3 });
    expect(nextPayment(yearly, "2026-11-17")).toBe("2027-03-15");
    expect(nextPayment(contract({ frequency: "none" }), "2026-11-17")).toBeNull();
  });

  it("paid by hand become a repeating Task; by direct debit, none", () => {
    const task = paymentTask(contract({}), "2026-11-17", "pt-PT")!;
    // The currency comes with a no-break space.
    expect({ ...task, title: task.title.replace(/\s/gu, " ") }).toEqual({
      title: "Pagar Luz (EDP) · 45,50 €",
      dueDate: "2026-12-08",
      repetition: { frequency: "monthly", interval: 1, end: { type: "never" } },
    });
    expect(paymentTask(contract({ payment: "debit" }), "2026-11-17", "pt-PT")).toBeNull();
  });

  it("warn of a renewal 30 days ahead and of a direct debit within the week", () => {
    const list = [
      contract({ id: "renews", renewalDate: "2026-12-10" }),
      contract({ id: "far", renewalDate: "2027-01-30" }),
      contract({ id: "debit", payment: "debit", payDay: 20 }),
      contract({ id: "later", payment: "debit", payDay: 28 }),
    ];
    expect(contractNotices(list, "2026-11-17").map((n) => [n.contract.id, n.kind, n.days])).toEqual(
      [
        ["debit", "debit", 3],
        ["renews", "renewal", 23],
      ],
    );
  });
});
