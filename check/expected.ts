// Ajo: npx tsx expected.ts
// Välit viimeisen tunnetun kuvan jälkeen (vrk). 23.10. oli kuvion 3 vrk:n välin jälkeen,
// joten seuraavat välit ovat 2, 2, 1, 2, 3 ja sitten kierto alkaa alusta.
const CYCLE = [2, 2, 1, 2, 3];

function nextExpected(lastDate: string, count = 5): string[] {
  const d = new Date(lastDate + "T00:00:00Z");
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    d.setUTCDate(d.getUTCDate() + CYCLE[i % CYCLE.length]);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

console.log(nextExpected("2026-10-23", 6));