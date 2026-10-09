# Takt vom PC (09.10.2026): stoesst einen GitHub-Workflow zur festen Ortszeit an.
# Grund: GitHub laesst geplante Laeufe ausfallen (08.10.: Mailagent 3 statt 9 Laeufe,
# 05.10.: Wochenwechsel fehlte). Die GitHub-Zeitplaene bleiben als Reserve stehen.
# Aufgerufen von den Aufgaben "Jarvis Takt ..." mit -Repo und -Workflow.
param([Parameter(Mandatory)][string]$Repo, [Parameter(Mandatory)][string]$Workflow)
$log = "C:\Users\admin\JarvisDashboard\logs\takt.log"
$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = "C:\Program Files\GitHub CLI\gh.exe" }
$out = & $gh workflow run $Workflow -R "Faltermaierdigital/$Repo" 2>&1
"$(Get-Date -Format s)  $Repo/$Workflow  Exit $LASTEXITCODE  $out" | Out-File -FilePath $log -Append -Encoding utf8
exit $LASTEXITCODE
