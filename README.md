# Jarvis Kontrollzentrum

Monitoring- und Start-Oberfläche für die GitHub-Actions-Agents von Faltermaier.

- **Keine Daten in diesem Repo.** Die Seite ist nur die Hülle. Alle Werte werden
  erst im Browser live über die GitHub-API aus den privaten Agent-Repos geholt.
- **Login = eigener Fine-grained Token** (nur die Agent-Repos, nur *Actions: Read and write*).
  Der Token bleibt im Arbeitsspeicher des Tabs, er wird nirgends gespeichert.
- **Kein Fremdcode:** keine Bibliotheken, keine CDNs. Alle Inhalte werden per
  `textContent` gebaut, nie per `innerHTML`, denn Absender und Betreffs kommen aus Spam-Mails.
- **Demo:** `?demo` an die Adresse hängen zeigt die Oberfläche mit erfundenen Beispieldaten.

## Neuen Agent hinzufügen

1. Der Agent läuft als GitHub-Workflow mit `workflow_dispatch` (Knopf-Start).
2. Optional legt er eine `result.json` als Artifact ab (`retention-days: 14`).
3. Eintrag in `config.js` ergänzen.
4. Liegt der Agent in einem neuen Repo, den Token um dieses Repo erweitern.
