// Welche Agents das Dashboard kennt. Neuer Agent = neuer Eintrag hier.
//
// Aktiver Agent: repo + workflow (Dateiname unter .github/workflows) + ref.
//   schedule    -> wann er laut Cron laufen sollte: utcHours (Liste) +
//                  utcMinute, fuer "ueberfaellig"
//   results     -> wie viele Ergebnis-Artifacts geladen werden (Standard 14)
//   quiet       -> planmaessige erfolgreiche Laeufe nicht in der Aktivitaet zeigen
//   graceHours  -> Toleranz, GitHub startet Cron-Laeufe oft verspaetet
//   artifact    -> Name des Ergebnis-Artifacts (optional), result.json darin
//   artifactFile-> anderer Dateiname im Artifact (Standard result.json)
//   confirm     -> Text der Sicherheitsabfrage vor dem manuellen Start
//   noStart     -> kein Start-Knopf (Text steht auf dem gesperrten Knopf)
//   localStart  -> { url: "jarvis://<aktion>", label, toast }: Start-Knopf ruft den
//                  Jarvis-Starter auf Josefs PC auf, Status kommt trotzdem vom Workflow
//   input       -> statt Sicherheitsabfrage ein Textfeld; der Text geht als
//                  workflow_dispatch-Input "text" mit (plus source=dashboard)
// Geplanter Agent: status: "planned" + note, dann ohne Start-Knopf.

export const OWNER = "Faltermaierdigital";

// Geklaerte Schank-Tage (Datum wie im smartSCHANK-Bericht). Diese Tage werden im
// Schank-Chart markiert und koennen im Schwund-Rechner ausgeklammert werden.
export const SCHANK_NOTES = {
  "23.09.2026": "Leitungsreinigung, falsch durchgeführt (Josef)",
};

export const AGENTS = [
  {
    id: "mailagent",
    name: "Claude-Mailagent",
    description: "Räumt Werbung aus allen Postfächern",
    icon: "mail",
    color: "cyan",
    repo: "claude-mailagent",
    // Seit 20.10.2026 laeuft er auf Josefs PC (lokal.py, Aufgabe "Jarvis Takt Mailagent")
    // statt auf GitHub (Minuten-Kontingent). Jeder Lauf meldet sich ueber bericht.yml.
    workflow: "bericht.yml",
    ref: "main",
    schedule: { utcHours: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], utcMinute: 10, label: "7:00, dann stündlich 8:10–22:10 vom PC (wenn er an ist)" },
    results: 90,
    graceHours: 3,
    artifact: "mailagent-result",
    localStart: { url: "jarvis://mail", label: "Jetzt prüfen", toast: "Der Mailagent prüft jetzt auf dem PC alle Postfächer (ca. 1 Minute). Danach aktualisieren." },
  },
  {
    id: "watchdiktat",
    name: "Watch-Diktat",
    description: "Diktat → Termin im Kalender oder Aufgabe in Todoist",
    icon: "mic",
    color: "green",
    repo: "watch-diktat",
    workflow: "diktat.yml",
    ref: "main",
    artifact: "diktat-result",
    input: {
      title: "Diktat eingeben",
      text: "Wie auf der Uhr: Claude entscheidet, ob daraus ein Termin oder eine Aufgabe wird.",
      placeholder: "z. B. Zahnarzt Dienstag 10 Uhr",
      button: "Eintragen",
    },
  },
  {
    id: "sync",
    name: "Kalender & To-dos",
    description: "Holt Termine (14 Tage) und offene Todoist-Aufgaben",
    icon: "calendar",
    color: "amber",
    repo: "watch-diktat",
    workflow: "sync.yml",
    ref: "main",
    schedule: { utcHours: [4, 6, 8, 10, 12, 14, 16, 18, 20], utcMinute: 0, label: "alle 2 Std. von 6 bis 22 Uhr" },
    graceHours: 1.5,
    artifact: "sync-result",
    artifactFile: "snapshot.json",
    results: 1,
    quiet: true,
    confirm: false,
  },
  {
    id: "dienstplan",
    name: "Dienstplan Küche",
    description: "Wochenwechsel + aktueller Plan fürs Dashboard",
    icon: "grid",
    color: "violet",
    repo: "dienstplan",
    workflow: "dienstplan.yml",
    ref: "main",
    schedule: { utcHours: [4, 6, 8, 10, 12, 14, 16, 18, 20], utcMinute: 30, label: "alle 2 Std. von 6:30 bis 22:30 Uhr" },
    graceHours: 1.5,
    artifact: "dienstplan-result",
    artifactFile: "snapshot.json",
    results: 1,
    quiet: true,
    confirm: false,
  },
  {
    id: "schank",
    name: "Brezn Schankbericht",
    description: "Zapfhahn gegen Kasse, täglich per Mail an josef@",
    icon: "beer",
    color: "amber",
    repo: "claude-mailagent",
    workflow: "smartschank.yml",
    ref: "main",
    schedule: { utcHours: [7], utcMinute: 30, label: "täglich 9:30 Uhr (Winter 8:30)" },
    graceHours: 3,
    artifact: "smartschank-result",
    artifactFile: "smartschank_result.json",
    results: 1,
    confirm: "Der Schankbericht wird neu erstellt und an josef@hotel-faltermaier.de geschickt.",
  },
  {
    id: "kosten",
    name: "Claude-Kosten",
    description: "Gesamtverbrauch aller Claude-Agenten (vom PC gesammelt)",
    icon: "pulse",
    color: "cyan",
    repo: "claude-mailagent",
    workflow: "claude-kosten.yml",
    ref: "main",
    // Laeuft auf Josefs PC (Aufgabe "Jarvis Claude-Kosten", kosten_sammeln.py), meldet sich hier.
    schedule: { utcHours: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], utcMinute: 50, label: "alle 2 Std. vom PC (wenn er an ist)" },
    graceHours: 3,
    artifact: "kosten-result",
    results: 1,
    quiet: true,
    noStart: "Läuft auf dem PC",
  },
  {
    id: "whatsapp",
    name: "WhatsApp-Mitleser",
    description: "Liest „Küche Brez'n“ mit (nur mit Einwilligung) → Frei-Wünsche direkt in den Dienstplan",
    icon: "chat",
    color: "green",
    repo: "whatsapp-mitleser",
    workflow: "status.yml",
    ref: "main",
    // Laeuft auf Josefs PC; der Auswerter meldet sich seit 20.10.2026 nur noch um 12 Uhr hier (GitHub-Minuten).
    // Ist der PC aus, kommt keine Meldung: dann "Überfällig" (normal, wenn der PC aus ist).
    schedule: { utcHours: [10], utcMinute: 5, label: "täglich 12 Uhr vom PC, bei Absturz sofort (Auswerter läuft weiter stündlich)" },
    graceHours: 3,
    artifact: "mitleser-result",
    results: 1,
    quiet: true,
    noStart: "Läuft auf dem PC",   // kein Start-Knopf: ein Start hier haette keinen Stand vom PC
  },
  {
    id: "opentable",
    name: "OpenTable-Reservierungen",
    description: "Reservierungszahlen beider Wochen aus OpenTable in den Dienstplan",
    icon: "grid",
    color: "amber",
    repo: "dienstplan",
    workflow: "opentable-status.yml",
    ref: "main",
    // Claude-Routine "dienstplan-opentable" auf Josefs PC (seit 21.10. stuendlich 9-21 Uhr, Jitter),
    // meldet sich am Ende ueber opentable_status.py. Ausgeloggt -> rot, haengt die Routine
    // oder ist der PC aus -> nach 3 Std. "Überfällig" (seit 21.10.2026).
    schedule: { utcHours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], utcMinute: 0, label: "stündlich 9–21 Uhr vom PC (wenn er an ist)" },
    graceHours: 3,
    artifact: "opentable-result",
    results: 1,
    quiet: true,
    noStart: "Läuft auf dem PC",
  },
  {
    id: "sicherung",
    name: "Datensicherung",
    description: "Vault + Jarvis-Gedächtnis → USB-Stick D: und Google Drive",
    icon: "shield",
    color: "cyan",
    repo: "jarvis-sicherung",
    workflow: "status.yml",
    ref: "main",
    // Laeuft auf Josefs PC (Aufgabe "Jarvis Datensicherung", 5:00 Uhr = 3:00 UTC im
    // Sommer, 4:00 UTC im Winter). War der PC aus, laeuft sie beim Einschalten nach.
    schedule: { utcHours: [3], utcMinute: 0, label: "täglich 5:00 Uhr vom PC (läuft nach, wenn der PC aus war)" },
    graceHours: 4,
    artifact: "sicherung-result",
    results: 1,
    quiet: true,
    localStart: { url: "jarvis://sichern", label: "Jetzt sichern", toast: "Sicherung läuft auf dem PC (ca. 1 Minute). Am Ende kommt dort ein Fenster mit dem Ergebnis." },
  },
];
