export type Lang = "fi" | "en";

const templates = {
  fi: {
    verifySubject: "Vahvista sähköpostiosoitteesi",
    verifyBody: (username: string, link: string, minutes: number) =>
      `Hei ${username},\n\nVahvista sähköpostiosoitteesi klikkaamalla linkkiä (voimassa ${minutes} minuuttia):\n${link}\n\nJos et rekisteröitynyt, voit jättää tämän viestin huomiotta.`,
  },
  en: {
    verifySubject: "Verify your email address",
    verifyBody: (username: string, link: string, minutes: number) =>
      `Hi ${username},\n\nPlease verify your email address by clicking the link (valid for ${minutes} minutes):\n${link}\n\nIf you did not register, you can ignore this message.`,
  },
} as const;

export function resolveLang(value: unknown): Lang {
  return value === "en" ? "en" : "fi"; // oletus suomi
}

export function getTemplates(lang: Lang) {
  return templates[lang];
}