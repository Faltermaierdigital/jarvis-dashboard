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

const DIKTATE = [
  ["Zahnarzt am Dienstag um zehn", "event", "Zahnarzt", "29.09.2026 10:00-11:00", "Google Kalender", true],
  ["Erinnere mich morgen das Angebot vom Großhändler nachzufassen", "task", "Angebot Großhändler nachfassen", "fällig 26.09.2026", "Todoist · Inbox", true],
  ["Weinlieferung prüfen", "task", "Weinlieferung prüfen", "ohne Datum", "Todoist · Inbox", true],
  ["Meeting mit dem Steuerberater Freitag 14 Uhr", "event", "Termin Steuerberater", "02.10.2026 14:00-15:00", "Google Kalender", true],
  ["Kühlhaus Wartung anrufen", "task", "", "", "", false],
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
    if (cfg.id === "dienstplan") {
      const t = new Date(now.getTime() - 25 * 60e3);
      const run = { id: ++id, status: "completed", conclusion: "success", event: "schedule", created_at: t.toISOString(),
        run_started_at: t.toISOString(), updated_at: new Date(t.getTime() + 30000).toISOString(), html_url: "#demo" };
      runs[cfg.id].push(run);
      const monday = new Date(now); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const fmtD = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
      const week = (offset, status, names) => {
        const von = new Date(monday); von.setDate(von.getDate() + offset * 7);
        const bis = new Date(von); bis.setDate(bis.getDate() + 6);
        return {
          tab: offset ? "Küche (nächste)" : "Küche", status, woche: { von: fmtD(von), bis: fmtD(bis) },
          reservierung_mittag: ["5", "5", "20", "10", "0", "12", "6"], reservierung_abend: ["27", "14", "19", "15", "39", "38", "16"],
          events: ["Messe", "Messe", "", "Bayern 20:30", "", "Stadtfest", "Stadtfest"],
          mitarbeiter: names.map(([name, codes, u, ue]) => ({ name, codes, urlaub: u, ueberstunden: ue })),
        };
      };
      const staff = [
        ["Koch A", ["8", "8", "/", "8", "8", "16", "/"], "12", "10:30"],
        ["Koch B", ["16", "/", "16", "16", "17", "17", "/"], "4", "-2:15"],
        ["Koch C", ["u", "u", "u", "u", "u", "/", "/"], "-1", "0:00"],
        ["Azubi D", ["Schule", "Schule", "Prüfung", "12", "12", "/", "/"], "20", "3:45"],
        ["Aushilfe E", ["/", "/", "/", "17", "/", "/", "/"], "0", "0:00"],
        ["Spüler F", ["K", "K", "12", "12", "/", "16", "16"], "8", "5:20"],
      ];
      results[run.id] = { agent: "dienstplan", finished_at: run.updated_at, sheet_url: "#", rollover: { hinweise: [] },
        wochen: [week(0, "laufend", staff), week(1, "kommend", staff.map(([n, , u, ue]) => [n, ["", "", "", "", "", "", ""], u, ue]))] };
      continue;
    }
    if (cfg.id === "sync") {
      const t = new Date(now.getTime() - 40 * 60e3);
      const run = { id: ++id, status: "completed", conclusion: "success", event: "schedule", created_at: t.toISOString(),
        run_started_at: t.toISOString(), updated_at: new Date(t.getTime() + 20000).toISOString(), html_url: "#demo" };
      runs[cfg.id].push(run);
      const day = (d, hh, mm) => { const x = new Date(now); x.setDate(x.getDate() + d); x.setHours(hh, mm, 0, 0); return x.toISOString(); };
      const date = (d) => {
        const x = new Date(now); x.setDate(x.getDate() + d);
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
      };
      results[run.id] = {
        agent: "sync", finished_at: run.updated_at, errors: [],
        events: [
          { title: "Zahnarzt", start: day(0, 17, 30), end: day(0, 18, 30), all_day: false, location: "Praxis Beispiel" },
          { title: "Lieferant Weinhandel", start: day(1, 10, 0), end: day(1, 11, 0), all_day: false },
          { title: "Tag der Deutschen Einheit", start: date(8), end: date(9), all_day: true, holiday: true },
          { title: "Steuerberater", start: day(3, 14, 0), end: day(3, 15, 0), all_day: false },
        ],
        tasks: [
          { id: "d1", content: "Angebot Großhändler nachfassen", project: "Inbox", priority: 4, due_date: date(-1), link: "#" },
          { id: "d2", content: "Weinlieferung prüfen", project: "Zur Brezn", priority: 3, due_date: date(0), link: "#" },
          { id: "d3", content: "Dienstplan freigeben", project: "Zur Brezn", priority: 1, due_date: `${date(0)}T15:00:00`, link: "#" },
          { id: "d4", content: "Muster bei Lieferant bezahlen", project: "Shop", priority: 2, due_date: date(4), link: "#" },
          { id: "d5", content: "Kühlhaus-Wartung anfragen", project: "Hotel", priority: 1, due_date: null, link: "#" },
        ],
      };
      continue;
    }
    if (cfg.id === "schank") {
      const t = new Date(now.getTime() - 3 * 3600e3);
      const run = { id: ++id, status: "completed", conclusion: "success", event: "schedule", created_at: t.toISOString(),
        run_started_at: t.toISOString(), updated_at: new Date(t.getTime() + 17000).toISOString(), html_url: "#demo" };
      runs[cfg.id].push(run);
      const verlauf = [];
      for (let d = 16; d >= 1; d--) {
        const x = new Date(now); x.setDate(x.getDate() - d);
        const tag = `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${x.getFullYear()}`;
        const hk = 50 + rand() * 120, wk = 15 + rand() * 25;
        const hz = hk + (rand() - 0.4) * 8, wz = wk + rand() * 5 + (d === 3 ? 26 : 0);
        verlauf.push({ tag, hell_zapf: hz, hell_kasse: hk, wb_zapf: wz, wb_kasse: wk, zapf_gesamt: hz + wz + 25,
          kasse_gesamt: hk + wk + 20, haus_liter: 20 + rand() * 25, haus_anzahl: 60 + Math.floor(rand() * 80),
          kredite: 300, kredite_ungenutzt: 280, fasswarnungen: d === 3 ? 14 : 3 + Math.floor(rand() * 4) });
      }
      const last = verlauf[verlauf.length - 1];
      results[run.id] = { agent: "schank", finished_at: run.updated_at, tag: last.tag, status: "OK", auffaellig: [], verlauf,
        haus_top: [["Stillwasser 0,4", 21], ["Saftschorle 0,4", 18], ["Aperol Spritz", 6]] };
      continue;
    }
    if (cfg.input) {
      DIKTATE.forEach(([text, type, title, whenText, target, ok], i) => {
        const t = new Date(now.getTime() - (i * 19 + 2) * 3600e3);
        const run = {
          id: ++id, status: "completed", conclusion: ok ? "success" : "failure",
          event: "workflow_dispatch", created_at: t.toISOString(), run_started_at: t.toISOString(),
          updated_at: new Date(t.getTime() + 24000).toISOString(), html_url: "#demo",
        };
        runs[cfg.id].push(run);
        results[run.id] = {
          agent: cfg.id, received_at: t.toISOString(), finished_at: run.updated_at, source: i % 3 ? "watch" : "dashboard",
          text, ok, ...(ok ? { type, title, when: whenText, target } : { error: "Todoist 401: Token ungültig" }),
        };
      });
      continue;
    }
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
