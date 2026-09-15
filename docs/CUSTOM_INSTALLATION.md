<!--
SPDX-FileCopyrightText: 2026 Nextcloud contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Polls mit Monatsansicht installieren

Dieser Fork ergänzt die vorhandene Nextcloud-App `polls` um eine Monatsansicht
mit Tagesdetails. Er verwendet dieselben Umfragen, öffentlichen Links, Identitäten,
Berechtigungen und Abstimmungs-Endpunkte wie die Originalansicht. Es gibt keinen
zusätzlichen Dienst, Proxy oder Docker-Container.

## Bedienung

- In einer **Terminumfrage** das Einstellungsmenü oben rechts öffnen und das
  Kalendersymbol **„Zur Monatsansicht wechseln“** wählen.
- Optional unter den persönlichen Polls-Einstellungen **„Standardansicht für
  Terminumfragen → Monatsansicht“** wählen. Das gilt auch auf dem Smartphone.
- Besitzer können unter **„Erzwungener Anzeigemodus → Monatsansicht“** die
  anfängliche Ansicht einer Umfrage einschließlich öffentlicher Links festlegen.
  Das Verhalten des bisherigen Ansichtswechsels bleibt erhalten.
- Die Kalenderzellen zeigen **beantwortete / vorhandene Optionen** für die eigene
  Identität. Auch ein ausdrückliches Nein zählt als beantwortet.
- Nach Auswahl eines Tages erscheinen nur dessen Optionen. Der bestehende
  Abstimmungsknopf wechselt zwischen Ja, gegebenenfalls Vielleicht und Nein bzw.
  keiner Antwort. Änderungen werden sofort gespeichert. Bei einem Fehler wird
  die vorherige Antwort wieder angezeigt; die Polls-Fehlermeldung erscheint.
- In den Tagesdetails setzen **„Alle Ja“**, **„Alle Vielleicht“** und **„Alle Nein“**
  die eigene Antwort für alle abstimmbaren Optionen des ausgewählten Tages.
  „Vielleicht“ und „Nein“ erscheinen nur, wenn die Umfrage diese Antworten zulässt.
  Gesperrte oder gelöschte Optionen bleiben unverändert; bereits passende Antworten
  werden übersprungen. Während des Speicherns sind Einzelstimmen, Tageswechsel
  und weitere Sammelabstimmungen gesperrt. Bei einzelnen Fehlern bleiben erfolgreich
  gespeicherte Stimmen erhalten; fehlgeschlagene Stimmen werden zurückgesetzt und
  ihre Anzahl angezeigt. Anschließend lassen sich einzelne Stunden weiter anpassen.
- Ergebnisse und Teilnehmernamen bleiben an die jeweiligen Polls-Berechtigungen
  gebunden. Ein öffentlicher Besucher muss sich über den bisherigen Gastablauf
  anmelden, bevor er abstimmen kann.
- Die sichtbare Zeitzone folgt der vorhandenen Polls-Zeitzonenauswahl. Ganztägige,
  mehrtägige und über Mitternacht laufende Optionen stehen einmal am **Starttag**;
  die Tagesdetails zeigen ihren vollständigen Zeitraum. Bei fehlenden oder
  ungültigen Datumsangaben verweist ein Hinweis auf Tabelle/Liste.
- Tabellen- und Listenansicht bleiben verfügbar; Textumfragen erhalten keine
  Monatsansicht. Optionensortierung nach Stimmen gilt weiterhin in Tabelle/Liste;
  der Kalender ordnet Zeitfenster chronologisch.

## Grundlage und Kompatibilität

Ausgangspunkt ist der Fork-Stand `91d65a015eb4f93abdf03a51b58e3c79cab59458`
mit Polls **9.3.0-beta.1**. `appinfo/info.xml` verlangt Nextcloud **31–35** und
PHP **ab 8.1**. Die Monatsansicht selbst fügt keine Datenbankmigration hinzu.
Ein Wechsel von einer älteren Polls-Version auf diese Beta kann aber bereits
vorhandene Upstream-Migrationen ausführen. Deshalb zunächst eine Kopie der
Installation verwenden und vor einem produktiven Upgrade Datenbank, Konfiguration
und bestehendes App-Verzeichnis sichern. Ein Downgrade nach Migrationen erfordert
gegebenenfalls die Wiederherstellung dieser zusammengehörigen Sicherungen.

Die App-ID und Versionsangabe bleiben unverändert, damit bestehende Daten und
Links weiterverwendet werden. Das ist eine **benutzerdefinierte, unsignierte
Installation**, keine offiziell signierte Polls-Veröffentlichung. Der originale
Signaturschlüssel steht dem Fork nicht zur Verfügung. Nextcloud kann deshalb eine
Integritätsmeldung für `polls` anzeigen. Die globale Integritätsprüfung sollte
aktiv bleiben; eine alte `signature.json` darf nicht mit neuen Dateien vermischt
werden. Siehe [Nextcloud: Code signing](https://docs.nextcloud.com/server/stable/admin_manual/issues/code_signing.html).

## Installationspaket aus GitHub Actions

Der Workflow **„Build custom calendar app“** erstellt ein Paket aus den gebauten
Frontend-Dateien und den PHP-Produktionsabhängigkeiten. Er läuft bei Änderungen
auf `feat/month-calendar-view` und `main`, außerdem manuell nach Übernahme des
Workflows auf den Standardbranch. Falls GitHub Workflows für den neuen Fork noch
pausiert sind, sie unter **Actions** aktivieren.

1. Im Fork unter **Actions → Build custom calendar app** den erfolgreichen Lauf
   des gewünschten Commits öffnen.
2. Das Artefakt **`polls-calendar-<Commit-SHA>`** herunterladen und die äußere
   GitHub-Artefakt-ZIP entpacken.
3. Darin liegen **`polls.tar.gz`** und **`polls.tar.gz.sha256`**.
4. Im entpackten Verzeichnis `sha256sum -c polls.tar.gz.sha256` ausführen.

Die GitHub-Schaltfläche „Download ZIP“ liefert nur Quellcode und ist kein
installierbares App-Paket. Der Workflow veröffentlicht nichts im Nextcloud
App Store und benötigt keine Registry- oder Signaturgeheimnisse.

## Alternativ lokal bauen

Auf einem Entwicklungsrechner mit Node.js 24, npm 11, PHP/Composer, GNU Make,
rsync und tar:

```bash
git clone --branch feat/month-calendar-view https://github.com/Ph0non/polls.git
cd polls
npm ci
npm run test:calendar
npm run build
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
make package
```

Das Paket liegt anschließend unter `build/artifacts/polls.tar.gz`. Der
Build-Rechner muss keine produktive Nextcloud sein. `composer install` benutzt
den vorhandenen Lockfile; `composer update` ist hierfür nicht nötig.

## Docker / Unraid: vorhandene App ersetzen

Die folgenden Beispiele verwenden die Pfade und den PHP-Benutzer des offiziellen
Nextcloud-Docker-Images. Bei anderen Images den tatsächlichen `occ`-Pfad,
PHP-Benutzer und das persistente App-Verzeichnis des Containers verwenden.
Alle Befehle werden auf dem Docker-Host ausgeführt. `nextcloud` im Beispiel durch
den eigenen Containernamen ersetzen.

Zuerst den tatsächlichen App-Pfad ermitteln:

```bash
NC_CONTAINER='nextcloud'
docker exec -u www-data "$NC_CONTAINER" php /var/www/html/occ app:getpath polls
docker inspect --format '{{json .Mounts}}' "$NC_CONTAINER"
```

Der Pfad sollte in einem persistenten Volume oder Bind-Mount liegen. Ein nur in
der beschreibbaren Containerschicht abgelegter Fork verschwindet beim Neuerstellen
des Containers. Es darf nur **ein** aktives Verzeichnis mit App-ID `polls` geben.
Die folgenden Befehle nehmen `/var/www/html/custom_apps/polls` an; nur verwenden,
wenn dies zum ermittelten Pfad passt.

Nach vollständiger Sicherung, in einem Wartungsfenster:

```bash
NC_CONTAINER='nextcloud'
# Absoluten Pfad zum heruntergeladenen und geprüften Paket angeben.
POLLS_ARCHIVE='/mnt/user/appdata/polls-build/polls.tar.gz'
# Sicherung außerhalb aller Nextcloud-App-Suchpfade ablegen.
POLLS_BACKUP='/mnt/user/appdata/polls-backups/before-calendar'
mkdir -p "$POLLS_BACKUP"

docker exec -u www-data "$NC_CONTAINER" php /var/www/html/occ maintenance:mode --on
docker cp "$NC_CONTAINER:/var/www/html/custom_apps/polls" "$POLLS_BACKUP/polls"
docker cp "$POLLS_ARCHIVE" "$NC_CONTAINER:/tmp/polls-calendar.tar.gz"
```

Die gesicherte App-Kopie und das Datenbankbackup prüfen. Dann das vorhandene
App-Verzeichnis aus dem App-Suchpfad verschieben und das neue Paket auspacken.
`/tmp/polls-before-calendar` muss frei sein; der Test verhindert Überschreiben:

```bash
docker exec "$NC_CONTAINER" sh -eu -c '
  test ! -e /tmp/polls-before-calendar
  mv /var/www/html/custom_apps/polls /tmp/polls-before-calendar
  tar -xzf /tmp/polls-calendar.tar.gz -C /var/www/html/custom_apps
  chown -R www-data:www-data /var/www/html/custom_apps/polls
'
docker exec -u www-data "$NC_CONTAINER" php /var/www/html/occ upgrade
docker exec -u www-data "$NC_CONTAINER" php /var/www/html/occ app:enable polls
docker exec -u www-data "$NC_CONTAINER" php /var/www/html/occ maintenance:mode --off
docker restart "$NC_CONTAINER"
```

Wenn ein Schritt fehlschlägt, den Wartungsmodus zunächst beibehalten und den
Fehler beheben bzw. die passende Sicherung wiederherstellen. Die App nicht über
`app:remove` deinstallieren und keine Polls-Datenbanktabellen löschen. Ein Neustart
lädt PHP/OPcache neu; anschließend den Browser vollständig neu laden.

## Nach der Installation prüfen

In einer separaten Testumfrage die Monatsansicht am Desktop und Smartphone öffnen,
eine Stimme setzen, sofort den Tag wechseln und anschließend die Seite neu laden.
Die Stimme muss gespeichert bleiben. Auch einen öffentlichen Gastlink,
Vielleicht/Nein-Einstellungen, gesperrte Optionen und ausgeblendete Ergebnisse
prüfen. Erst danach die bestehende große Umfrage verwenden.

Frontend-Build und isolierte Kalender-/Komponententests ersetzen keinen
Integrationstest mit der eigenen Nextcloud-Version und deren Datenbank.

## Updates und Rückkehr zur Original-App

Ein App-Store-Update von `polls` kann den Fork überschreiben. Automatische
App-Updates für diese Installation entsprechend berücksichtigen. Bei Upstream-
Updates den Monatsansicht-Branch auf den neuen Stand bringen, erneut bauen und
nach Sicherung installieren. Vor einer Rückkehr zum Original die persönlichen
und erzwungenen Ansichten auf Tabelle/Liste setzen, da das Original `month-view`
nicht kennt. Keine niedrigere App-Version über einen bereits migrierten
Datenbestand installieren; dafür die passende Sicherung verwenden.
