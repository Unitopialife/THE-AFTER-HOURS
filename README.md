# THE AFTER HOURS – Gastronomie-Kassensystem

Modernes, responsives Kassensystem für GitHub Pages mit Supabase als sicherem Backend.

## Enthaltene Funktionen

- Dunkles THE-AFTER-HOURS-Design für Desktop, Tablet und Smartphone
- Mitarbeiter-Login ohne öffentliche Registrierung
- Erster Login mit verpflichtendem Passwortwechsel
- Rollen: Inhaber, Administrator, Schichtleitung, Kassenmitarbeiter und Lagerverwaltung
- Individuelle Zusatzrechte je Mitarbeiter
- Dashboard mit Umsatz, Bestellungen, Bar/Karte, Trinkgeld, Lagerwarnungen und Mitteilungen
- Bestellungen mit Bar-/Kartenzahlung, Rückgeld, Trinkgeld und Organisationsrabatt
- Menüs mit Rezepturen und Produktbild-Upload
- Automatische Lagerabbuchung beim Verkauf
- Sichere Rückbuchung bei Stornierung oder Rückerstattung
- Zutaten, Wareneinkäufe, Korrekturen und Bestandsverlauf
- Organisationen mit Prozent- oder Festbetrag-Rabatt
- Änderbare Steuern, Verkaufsorte, Kategorien, Währung und Firmendaten
- Dauerhaftes Audit-Protokoll
- Supabase Row Level Security, Datenbank-RPCs und Edge Functions

## Demo lokal starten

Wenn du ohne Supabase testen möchtest, setze in `assets/js/config.js` vorübergehend `demoMode: true` oder lasse `supabaseUrl` und `supabasePublishableKey` leer.

1. Ordner öffnen.
2. Einen lokalen Webserver starten:

```bash
python -m http.server 8080
```

3. `http://localhost:8080` öffnen.
4. Demo-Zugang:

```text
Benutzername: inhaber
Passwort: afterhours
```

Demo-Daten werden im Browser über `localStorage` gespeichert. Unter **Einstellungen** können sie zurückgesetzt werden.

## Supabase einrichten

### 1. Projekt erstellen

Erstelle ein neues Supabase-Projekt und öffne anschließend den SQL Editor.

### 2. Öffentliche Registrierung deaktivieren

Öffne in Supabase die Auth-Einstellungen und deaktiviere die öffentliche Benutzerregistrierung. Mitarbeiterkonten werden ausschließlich durch die geschützten Admin-Funktionen erstellt. Für den Login erzeugt das Backend intern eine Adresse nach dem Muster `benutzername@afterhours.local`; die Oberfläche verwendet den Benutzernamen.

### 3. Datenbank installieren

Führe den vollständigen Inhalt dieser Datei aus:

```text
supabase/schema.sql
```

Die Datei erstellt Tabellen, Indizes, RLS-Richtlinien, sichere Bestell- und Lagerfunktionen sowie den Storage-Bucket `product-images`.

### 4. Erstes Inhaberkonto anlegen

1. In Supabase **Authentication → Users** öffnen.
2. Einen Benutzer mit E-Mail und Startpasswort erstellen, zum Beispiel `inhaber@afterhours.local`.
3. Die UUID des Auth-Benutzers kopieren.
4. Den Bootstrap-Befehl am Ende von `supabase/schema.sql` mit dieser UUID ausführen.

Beispiel:

```sql
insert into public.profiles(id,username,email,full_name,role,active,must_change_password)
values(
  'AUTH-USER-UUID',
  'inhaber',
  'inhaber@afterhours.local',
  'André Kasper',
  'owner',
  true,
  true
);
```

Beim ersten Login muss das Passwort geändert werden.

### 5. Edge Functions bereitstellen

Mit installierter Supabase CLI:

```bash
supabase login
supabase link --project-ref DEIN-PROJEKT-REF
supabase functions deploy complete-first-login
supabase functions deploy create-employee
supabase functions deploy update-employee
```

Die benötigten Supabase-Umgebungsvariablen stehen den bereitgestellten Edge Functions standardmäßig zur Verfügung. Der geheime Backend-Schlüssel bleibt ausschließlich in Supabase und darf niemals in GitHub Pages eingetragen werden.

### 6. Frontend verbinden

Öffne `assets/js/config.js` und trage die Projekt-URL sowie den **Publishable Key** ein:

```js
window.AFTER_HOURS_CONFIG = {
  supabaseUrl: 'https://DEIN-PROJEKT.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
  demoMode: false,
  currency: 'USD',
  locale: 'de-DE'
};
```

Der Publishable Key ist für Browser-Anwendungen vorgesehen. Die Sicherheit wird durch Auth, RLS, Datenbankrechte und serverseitige Funktionen hergestellt. Trage niemals einen Secret Key oder `service_role`-Key in `config.js` ein.

## GitHub Pages veröffentlichen

1. Alle Dateien in ein GitHub-Repository hochladen.
2. In GitHub **Settings → Pages** öffnen.
3. Unter **Build and deployment** die Option **Deploy from a branch** wählen.
4. Branch `main` und Ordner `/ (root)` auswählen.
5. Speichern und die angezeigte Pages-Adresse öffnen.

## Projektstruktur

```text
index.html
assets/
  css/styles.css
  js/config.js
  js/app.js
supabase/
  schema.sql
  config.toml
  functions/
    complete-first-login/index.ts
    create-employee/index.ts
    update-employee/index.ts
```

## Sicherheitsmodell

- Im Browser befindet sich nur der Publishable Key.
- Alle öffentlich erreichbaren Tabellen verwenden Row Level Security.
- Rollen und Rechte werden aus `profiles` gelesen, nicht aus veränderbaren Benutzermetadaten.
- Preise werden beim Checkout in der Datenbank erneut ausgelesen und berechnet.
- Lagerbestände werden atomar innerhalb einer Datenbanktransaktion geändert.
- Jede Bestellung speichert einen Snapshot der tatsächlich verbrauchten Zutaten.
- Stornierungen verwenden diesen Snapshot und bleiben daher auch nach späteren Rezeptänderungen korrekt.
- Mitarbeiterkonten werden ausschließlich über geschützte Edge Functions erstellt oder geändert.
- Der erste Passwortwechsel läuft über eine geschützte Edge Function; `must_change_password` ist nicht direkt per Browser schreibbar.
- Secret-/Service-Role-Schlüssel dürfen niemals im Frontend oder Repository veröffentlicht werden.

## Vor echtem Kassenbetrieb

Dieses Projekt ist eine solide technische Grundlage. Vor einem realen steuer- oder buchhaltungsrelevanten Einsatz sollten insbesondere Fiskalisierung, Belegpflicht, GoBD/TSE-Anforderungen, Datenschutz, Backups, Ausfallsicherheit und lokale Rechtsvorgaben von geeigneten Fachleuten geprüft und ergänzt werden.
