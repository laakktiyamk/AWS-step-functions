"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLang = resolveLang;
exports.getTemplates = getTemplates;
const templates = {
    fi: {
        verifySubject: "Vahvista sähköpostiosoitteesi",
        verifyBody: (username, link, minutes) => `Hei ${username},\n\nVahvista sähköpostiosoitteesi klikkaamalla linkkiä (voimassa ${minutes} minuuttia):\n${link}\n\nJos et rekisteröitynyt, voit jättää tämän viestin huomiotta.`,
    },
    en: {
        verifySubject: "Verify your email address",
        verifyBody: (username, link, minutes) => `Hi ${username},\n\nPlease verify your email address by clicking the link (valid for ${minutes} minutes):\n${link}\n\nIf you did not register, you can ignore this message.`,
    },
};
function resolveLang(value) {
    return value === "en" ? "en" : "fi"; // oletus suomi
}
function getTemplates(lang) {
    return templates[lang];
}
