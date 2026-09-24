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

export const OWNER = "Faltermaierdigital";

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
    schedule: { utcHours: [6], utcMinute: 10, label: "täglich 8:10 Uhr (Winter 7:10)" },
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
    name: "Dienstplan-Bot",
    description: "Reservierungen & Events → Dienstplan Küche",
    icon: "calendar",
    color: "violet",
    status: "planned",
    note: "Umzug auf GitHub ausstehend",
  },
];
