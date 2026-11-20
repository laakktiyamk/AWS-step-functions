export type Lang = "fi" | "en";

const templates = {
  fi: {
    verifySubject: "Vahvista sähköpostiosoitteesi",
    verifyBody: (username: string, link: string, minutes: number) =>
      `Hei ${username},\n\nVahvista sähköpostiosoitteesi klikkaamalla linkkiä (voimassa ${minutes} minuuttia):\n${link}\n\nJos et rekisteröitynyt, voit jättää tämän viestin huomiotta.`,
        resetSubject: "Salasanan vaihto",
    resetBody: (username: string, link: string, minutes: number) =>
      `Hei ${username},\n\nVoit asettaa uuden salasanan klikkaamalla linkkiä (voimassa ${minutes} minuuttia):\n${link}\n\nJos et pyytänyt salasanan vaihtoa, voit jättää tämän viestin huomiotta. Salasanasi ei muutu.`,
  },
  en: {
    verifySubject: "Verify your email address",
    verifyBody: (username: string, link: string, minutes: number) =>
      `Hi ${username},\n\nPlease verify your email address by clicking the link (valid for ${minutes} minutes):\n${link}\n\nIf you did not register, you can ignore this message.`,
        resetSubject: "Reset your password",
    resetBody: (username: string, link: string, minutes: number) =>
      `Hi ${username},\n\nYou can set a new password by clicking the link (valid for ${minutes} minutes):\n${link}\n\nIf you did not request a password reset, you can ignore this message. Your password will not change.`,
  },
} as const;

export function resolveLang(value: unknown): Lang {
  return value === "en" ? "en" : "fi"; // oletus suomi
}

export function getTemplates(lang: Lang) {
  return templates[lang];
}