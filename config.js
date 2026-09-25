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
//   input       -> statt Sicherheitsabfrage ein Textfeld; der Text geht als
//                  workflow_dispatch-Input "text" mit (plus source=dashboard)
// Geplanter Agent: status: "planned" + note, dann ohne Start-Knopf.
// Lokaler Agent: local: "jarvis://<aktion>" - der Knopf ruft den Jarvis-Starter auf
//   Josefs PC auf (C:\Users\admin\JarvisDashboard\jarvis-starter.ps1). Kein GitHub-Status.

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
    schedule: { utcHours: [4, 6, 8, 10, 12, 14, 16, 18, 20], utcMinute: 10, label: "alle 2 Std. von 6:10 bis 22:10 Uhr" },
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
    id: "dienstplan-live",
    name: "Dienstplan live",
    description: "OpenTable + Tima mit deinem Login → Reservierungen, Urlaub, Überstunden",
    icon: "play",
    color: "amber",
    local: "jarvis://dienstplan",
    note: "läuft auf deinem PC · Ergebnis danach unter Dienstplan",
  },
];
