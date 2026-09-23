// Beispieldaten fuer ?demo - komplett erfunden, keine echten Postfaecher.
// Damit laesst sich die Oberflaeche ohne Token ansehen und testen.

const ACCOUNTS = [
  "info@beispiel-hotel.de", "rezeption@beispiel-hotel.de", "buchhaltung@beispiel-hotel.de",
  "chef@beispiel-hotel.de", "info@beispiel-wirtshaus.de", "shop@beispiel-shop.de",
  "einkauf@beispiel-hotel.de", "privat@beispiel-mail.de",
];
const SENDERS = [
  ["Möbelhaus Nord <news@moebel-nord.example>", "Nur heute: 40 % auf alles", "Rabattaktion mit Abmeldelink"],
  ["Gastro-Großhandel <angebote@grosshandel.example>", "Wochenangebote KW 39", "Lieferanten-Newsletter"],
  ["Kaffeerösterei <hallo@roesterei.example>", "Dein Gutschein läuft bald ab", "Gutscheincode abgelaufen"],
  ["Reiseportal <deals@reisen.example>", "Last-Minute-Deals für Herbst", "Werbe-Newsletter"],
  ["Software-Anbieter <marketing@saas.example>", "Neue Tools. Weniger Routine.", "Produkt-Newsletter"],
  ["Weinhandel <shop@wein.example>", "Herbstpaket mit 25 % Rabatt", "Verkaufsmail mit Rabatt"],
];
const FLAGS = [
  ["Kundenservice <no-reply@paypa1-sicherheit.example>", "Zahlung fehlgeschlagen REF: 88341", "Gefälschte Absenderdomain"],
  ["Lieferdienst <info@privaterelay.example>", "Ihre Rechnung ist fällig", "Verdächtige Rechnungsdomain"],
];

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function buildDemo(agents) {
  const now = new Date();
  const rand = rng(42);
  const runs = {};
  const results = {};
  let id = 9000;

  for (const cfg of agents) {
    if (cfg.status === "planned") continue;
    runs[cfg.id] = [];
    for (let d = 13; d >= 0; d--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d, 6, 10 + Math.floor(rand() * 40), Math.floor(rand() * 59)));
      if (start > now) continue;
      const fail = d === 9;
      const end = new Date(start.getTime() + (80 + rand() * 60) * 1000);
      const run = {
        id: ++id,
        status: "completed",
        conclusion: fail ? "failure" : "success",
        event: d === 3 ? "workflow_dispatch" : "schedule",
        created_at: start.toISOString(),
        run_started_at: start.toISOString(),
        updated_at: end.toISOString(),
        html_url: "#demo",
      };
      runs[cfg.id].unshift(run);
      if (fail || !cfg.artifact) continue;

      const accounts = ACCOUNTS.map((acc, i) => {
        const skipped = d < 2 && i === 7;
        const items = [];
        if (!skipped) {
          const n = Math.floor(rand() * 3.2);
          for (let k = 0; k < n; k++) {
            const [from, subject, reason] = SENDERS[Math.floor(rand() * SENDERS.length)];
            items.push({ from, subject, reason, date: start.toUTCString(), action: "candidate", error: null });
          }
          if (rand() > 0.88) {
            const [from, subject, reason] = FLAGS[Math.floor(rand() * FLAGS.length)];
            items.push({ from, subject, reason, date: start.toUTCString(), action: "flagged", error: null });
          }
        }
        return {
          account: acc,
          status: skipped ? "skipped" : "ok",
          error: skipped ? "Kein Passwort im IMAP_PASSWORDS-Secret hinterlegt" : null,
          scanned: skipped ? 0 : 3 + Math.floor(rand() * 20),
          items,
        };
      });
      const all = accounts.flatMap((a) => a.items);
      results[run.id] = {
        agent: cfg.id,
        date: start.toISOString().slice(0, 10),
        finished_at: end.toISOString(),
        live_mode: false,
        totals: {
          accounts_total: accounts.length,
          accounts_ok: accounts.filter((a) => a.status === "ok").length,
          scanned: accounts.reduce((s, a) => s + a.scanned, 0),
          candidates: all.filter((i) => i.action !== "flagged").length,
          moved: 0,
          failed: 0,
          flagged: all.filter((i) => i.action === "flagged").length,
        },
        accounts,
      };
    }
  }
  return { runs, results };
}
