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
    workflow: "mailagent.yml",
    ref: "main",
    schedule: { utcHours: [5, 6, 8, 10, 12, 14, 16, 18, 20], utcMinute: 10, label: "7:00, dann alle 2 Std. von 8:10 bis 22:10 Uhr" },
    results: 90,
    graceHours: 3,
    artifact: "mailagent-result",
    confirm: "Der Mailagent prüft jetzt alle Postfächer. Ab dem 28.09. verschiebt er erkannte Werbung dabei in den Papierkorb.",
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
    description: "Gesamtverbrauch aller Claude-Agenten (Admin-API)",
    icon: "pulse",
    color: "cyan",
    repo: "claude-mailagent",
    workflow: "claude-kosten.yml",
    ref: "main",
    schedule: { utcHours: [0, 6, 12, 18], utcMinute: 40, label: "alle 6 Std." },
    graceHours: 3,
    artifact: "kosten-result",
    results: 1,
    quiet: true,
    confirm: false,
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
    // Laeuft auf Josefs PC; der stuendliche Auswerter-Lauf dort meldet sich hier.
    // Ist der PC aus, kommt keine Meldung: dann "Überfällig" (normal, wenn der PC aus ist).
    schedule: { utcHours: [...Array(24).keys()], utcMinute: 5, label: "stündlich vom PC (wenn er an ist)" },
    graceHours: 3,
    artifact: "mitleser-result",
    results: 1,
    quiet: true,
    noStart: "Läuft auf dem PC",   // kein Start-Knopf: ein Start hier haette keinen Stand vom PC
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
