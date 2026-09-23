// Welche Agents das Dashboard kennt. Neuer Agent = neuer Eintrag hier.
//
// Aktiver Agent: repo + workflow (Dateiname unter .github/workflows) + ref.
//   schedule    -> wann er laut Cron laufen sollte (UTC), fuer "ueberfaellig"
//   graceHours  -> Toleranz, GitHub startet Cron-Laeufe oft verspaetet
//   artifact    -> Name des Ergebnis-Artifacts (optional), result.json darin
//   confirm     -> Text der Sicherheitsabfrage vor dem manuellen Start
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
    schedule: { utcHour: 6, utcMinute: 10, label: "täglich 8:10 Uhr (Winter 7:10)" },
    graceHours: 3,
    artifact: "mailagent-result",
    confirm: "Der Mailagent prüft jetzt alle Postfächer. Ab dem 28.09. verschiebt er erkannte Werbung dabei in den Papierkorb.",
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
