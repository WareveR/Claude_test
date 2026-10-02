import type { Language } from "../core/languages";

export type Email = { to: string; subject: string; text: string };

/**
 * Where emails go. Normally Cloudflare Email Service; tests swap `send` for a fake outbox.
 * A failed send never undoes the change that caused it.
 */
export const mailer = {
  async send(env: Env, email: Email) {
    await env.EMAIL.send({ from: env.EMAIL_FROM, ...email });
  },
};

export async function sendEmail(env: Env, email: Email) {
  try {
    await mailer.send(env, email);
    return true;
  } catch (error) {
    console.error("email failed", error);
    return false;
  }
}

type Texts = {
  recoverySubject: string;
  recoveryText: (link: string) => string;
  confirmSubject: string;
  confirmText: (link: string) => string;
  passwordChangedSubject: string;
  passwordChangedText: string;
  emailChangedSubject: string;
  emailChangedText: (address: string) => string;
};

/** Emails are written in the Family Language. */
export const EMAIL_TEXTS: Record<Language, Texts> = {
  "pt-PT": {
    recoverySubject: "Escolher uma nova Palavra-passe da Família",
    recoveryText: (link) =>
      `Alguém pediu para escolher uma nova Palavra-passe da Família.\n\nAbre esta ligação na próxima hora para a escolher (só funciona uma vez):\n${link}\n\nSe não foste tu, ignora este email; nada muda.`,
    confirmSubject: "Confirmar o email de recuperação",
    confirmText: (link) =>
      `Este endereço foi indicado como email de recuperação do calendário da Família.\n\nAbre esta ligação nas próximas 24 horas para o confirmar:\n${link}\n\nSe não esperavas isto, ignora este email.`,
    passwordChangedSubject: "A Palavra-passe da Família mudou",
    passwordChangedText:
      "A Palavra-passe da Família acabou de mudar e todos os dispositivos saíram.\n\nSe não foi ninguém da Família, escolhe uma nova com «Esqueci-me da palavra-passe».",
    emailChangedSubject: "O email de recuperação mudou",
    emailChangedText: (address) =>
      `O email de recuperação do calendário da Família passou a ser ${address}.\n\nSe não foi ninguém da Família, avisa quem instalou o calendário.`,
  },
  en: {
    recoverySubject: "Choose a new Family Password",
    recoveryText: (link) =>
      `Someone asked to choose a new Family Password.\n\nOpen this link within the next hour to choose it (it works once):\n${link}\n\nIf it wasn't you, ignore this email; nothing changes.`,
    confirmSubject: "Confirm the recovery email",
    confirmText: (link) =>
      `This address was given as the recovery email of the Family calendar.\n\nOpen this link within 24 hours to confirm it:\n${link}\n\nIf you weren't expecting this, ignore this email.`,
    passwordChangedSubject: "The Family Password changed",
    passwordChangedText:
      'The Family Password has just changed and every device was signed out.\n\nIf it wasn\'t anyone in the Family, choose a new one with "Forgot password".',
    emailChangedSubject: "The recovery email changed",
    emailChangedText: (address) =>
      `The Family calendar's recovery email is now ${address}.\n\nIf it wasn't anyone in the Family, tell whoever installed the calendar.`,
  },
};
