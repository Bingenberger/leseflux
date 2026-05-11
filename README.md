# Lesefluss

Tablet-optimierte Web-App zum Training der Leseflüssigkeit für Grundschulkinder der Klassen 2–4.

---

## 1. Didaktischer Hintergrund

### Leseflüssigkeit als Lernziel

Leseflüssigkeit (Lesen mit angemessener Geschwindigkeit, Genauigkeit und Prosodie) gilt als Schlüsselkompetenz für das Leseverstehen. Stockendes, mühsames Lesen belastet das Arbeitsgedächtnis so stark, dass für das Verstehen des Inhalts kaum noch Kapazität bleibt. Gezielte Trainingsverfahren, die auf Automatisierung der Worterkennung abzielen, können die Flüssigkeit messbar verbessern.

### Constant Fading

Lesefluss setzt das Verfahren **Constant Fading** um. Der zu lesende Text ist vollständig sichtbar; die Wörter werden jedoch von links nach rechts nacheinander **ausgeblendet** – mit einer Geschwindigkeit, die dem individuellen Zieltempo des Kindes entspricht. Das Kind wird so sanft gezwungen, mitzulesen, ohne dass der Text wegblendet oder springt. Im Unterschied zu klassischem RSVP (Rapid Serial Visual Presentation) bleibt der Kontext des Satzes immer sichtbar, was das Leseverständnis fördert.

### Adaptivität

Das Zieltempo (WPM – Wörter pro Minute) wird **automatisch angepasst**:

- Nach dem ersten Login absolviert das Kind einen kurzen **Eingangstest** (Sätze auf Sinn/Unsinn beurteilen), aus dem das initiale Lesetempo abgeleitet wird.
- Nach je 5 Trainingseinheiten prüft die adaptive Engine den gleitenden Genauigkeitsdurchschnitt der Quizfragen. Bei ≥ 70 % Genauigkeit steigt das Tempo um 5 WPM; bei < 40 % sinkt es.
- Alle 10 Sitzungen wird ein **Zwischentest** angeboten, der das Tempo direkt neu kalibriert.

### Übungsformen

| Übung | Beschreibung |
|---|---|
| **Fading-Lesen** | Kernübung: Text mit ausblendendem Fading lesen, anschließend Verständnisfragen |
| **Wortblitz** | Wörter werden kurz aufgeblitzt; Kind wählt das richtige Wort aus Ablenkern |
| **Lückentext (Cloze)** | Einzelne Wörter fehlen im Text; Kind wählt aus vorgegebenen Optionen |
| **Freies Lesen** | Text ohne Fading-Zwang; Lesetempo wird gemessen und für Statistiken genutzt |

### Datenschutz (DSGVO)

Die App ist für den Einsatz mit Kindern konzipiert und verarbeitet bewusst minimale Daten: Kinder werden nur mit Spitznamen angelegt, Logins erfolgen per QR-Code ohne E-Mail-Adresse, und alle gespeicherten Token sind als SHA-256-Hash abgelegt.

---

## 2. Aufbau der App

### Rollen

| Rolle | Beschreibung |
|---|---|
| **Kind** | Meldet sich per QR-Code oder kurzem Login-Code an; sieht nur die eigene Trainingsansicht |
| **Lehrkraft** | Verwaltet Klassen, Schülerinnen und Schüler, Texte, Vorlagen und Diagnostikkonfiguration; sieht Fortschrittsberichte |
| **Admin** | Wie Lehrkraft, zusätzlich: Lehrkräfte anlegen/verwalten, Diagnostiksätze und Wortblitz-Wörter importieren |

### Workflow

```
Admin legt Lehrkraft an
  └─ Lehrkraft legt Klasse an
       └─ Lehrkraft legt Schülerin/Schüler an (Einwilligung bestätigen)
            └─ Kind scannt QR-Code → Eingangstest → tägliches Training
                 └─ Lehrkraft sieht Fortschritt im Dashboard
```

### Tagesablauf eines Kindes

1. QR-Code scannen oder Login-Code eingeben
2. Falls noch kein Eingangstest: Eingangstest absolvieren (ca. 1 Minute)
3. Trainingsdauer wählen (10 oder 15 Minuten)
4. Trainingseinheit: Wortblitz → Fading-Lesen + Quiz → Lückentext
5. Ergebnis und Sterne sehen; ggf. Zwischentest absolvieren
6. Pro Tag ist eine Trainingseinheit möglich

### Trainingsvorlage

Welche Übungen in welcher Reihenfolge und Dauer erscheinen, steuert eine **Sitzungsvorlage**. Vorlagen können pro Klasse zugewiesen werden. Alle 5 Sitzungen wechselt das System automatisch auf eine „Messtag"-Vorlage (freies Lesen statt Fading), um das Lesetempo sauber zu messen.

---

## 3. Installation

### Voraussetzungen

- Docker Desktop (oder Docker Engine + Compose)
- Node.js 20 + npm 10
- Freier Port 5173 (Frontend), 3001 (Backend), 5433 (Datenbank)

### Schritt für Schritt

```bash
# 1. Repository klonen
git clone <repo-url>
cd Lesefluss

# 2. Umgebungsvariablen anlegen
cp .env.example .env
```

In `.env` mindestens anpassen:

```env
JWT_SECRET=langer_zufaelliger_string   # zwingend erforderlich
DATABASE_URL=postgresql://leseflux:password@localhost:5433/leseflux
CORS_ORIGIN=http://localhost:5173
```

```bash
# 3. Datenbank starten
docker-compose up -d postgres

# 4. Abhängigkeiten installieren
npm install

# 5. Datenbankschema migrieren
npm run db:migrate

# 6. Basisdaten einspielen (Diagnostiksätze, Demo-Lehrkraft, Demo-Schüler)
npm run db:seed

# 7. Entwicklungsserver starten (Frontend + Backend parallel)
npm run dev
```

| Dienst | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |

**Demo-Zugangsdaten** (nach `db:seed`):
- Lehrkraft: `demo@leseflux.schule` / `Lehrer1234!`
- Schüler-QR-Token: wird beim Seed im Terminal ausgegeben

### Texte und Wortblitz-Wörter importieren

Im Ordner `packages/text/` liegen fertige Importdateien:

```bash
# Lesetexte importieren
npm run seed:texts -- ./packages/text/texte.json

# Wortblitz-Wörter importieren (über das Admin-Dashboard oder direkt)
npx tsx apps/api/scripts/seedFlashWords.ts
```

Alternativ können Texte und Wörter im Lehrer- bzw. Admin-Dashboard über den Menüpunkt **Texte** bzw. **Wortblitz** als JSON-Datei hochgeladen werden. Das Format:

**Texte** (`packages/text/texte.json`):
```json
[
  {
    "title": "Der Igel",
    "content": "Der kleine Igel Fritz sucht...",
    "targetLevel": 2,
    "questions": [
      { "question": "Was sucht der Igel?", "options": ["Futter", "Wasser", "Blätter"], "correctIndex": 0 }
    ]
  }
]
```
`targetLevel`: `2` = Klasse 2, `3` = Klasse 3, `4` = Klasse 4

**Wortblitz-Wörter** (`packages/text/wortblitz1.json`):
```json
[
  { "word": "Haus", "syllables": 1, "difficultyLevel": 1, "distractors": ["Hans", "Hase"] }
]
```

### Produktion (Docker)

```bash
docker-compose up -d    # startet postgres + api + web + nginx
docker-compose build    # Images neu bauen nach Code-Änderungen
```

TLS: Let's-Encrypt-Zertifikate nach `nginx/certs/` legen (`fullchain.pem`, `privkey.pem`).

---

## 4. Technische Dokumentation

### Monorepo-Struktur

```
apps/
  web/          React 18 + TypeScript + Vite + Tailwind CSS   (Port 5173)
  api/          Fastify + TypeScript + Prisma ORM             (Port 3001)
packages/
  shared/       Zod-Schemas, Algorithmen, gemeinsame Typen
  text/         Fertige Import-Dateien (Texte, Wortblitz-Wörter)
nginx/          Reverse-Proxy + TLS-Konfiguration
docker-compose.yml
```

`packages/shared` ist die einzige Wahrheitsquelle für alle Typen, die die API-Grenze überschreiten. Typen werden nie doppelt in `web` und `api` definiert.

### Fading-Algorithmus (`packages/shared/src/fading.ts`)

Die Anzeigedauer pro Wort wird längenkorrigiert berechnet:

```
msProWort       = 60.000 / targetWpm
Anzeigedauer    = msProWort × 0,70 × Längenfaktor
Ausblenddauer   = msProWort × 0,30 × Längenfaktor
Längenfaktor    = 0,6 + 0,4 × √(Wortlänge / 5,5)
```

Die Wurzel-Skalierung verhindert, dass sehr lange Wörter überproportional viel Zeit bekommen. Das nächste Wort blendet ein, während das vorherige noch ausblendet (überlappend, kein Leerstand).

### Adaptive Engine (`apps/api/src/modules/training/adaptive.ts`)

Alle Schwellenwerte liegen in `apps/api/src/config.ts` und können ohne Code-Änderung angepasst werden:

| Parameter | Standardwert |
|---|---|
| Sitzungen bis zur Anpassung (Fading) | 5 |
| Genauigkeitsschwelle Erhöhung | ≥ 70 % |
| Genauigkeitsschwelle Senkung | < 40 % |
| WPM-Schrittweite | ±5 |
| Sitzungen bis Zwischentest | 10 |
| Startfaktor (% der Diagnostik-WPM) | 90 % |

Für den Wortblitz gilt ein eigener Regler (`adaptiveConfig.flashWord`): Anzeigedauer wird alle 3 Sitzungen um 50 ms verkürzt oder verlängert; bei Unterschreitung von 250 ms steigt das Schwierigkeitslevel.

### LIX-Berechnung

```
LIX = (W / S) + (L × 100 / W)
```
W = Wörter, S = Sätze, L = Wörter mit mehr als 6 Zeichen. Wird beim Textimport automatisch berechnet und gespeichert. Dient zur Zuweisung eines Textes zu einer Klassenstufe.

### Auth-Flow

- **Kinder**: QR-Code scannen → `POST /api/auth/login-child` → Backend hasht Token mit SHA-256, sucht `users.qrTokenHash` → JWT (24 h) als HTTP-only-Cookie
- **Lehrkräfte/Admins**: E-Mail + Passwort → `POST /api/auth/login-teacher` → argon2-Verify → JWT (8 h)
- CSRF-Schutz durch `sameSite: strict`-Cookie; Helmet.js für Security-Header; Rate-Limiting (10/min) auf Login-Endpunkten

### Datenbank-Schema (Kern)

```
User ──── Class ──── SessionTemplate
 │                        │
 ├── UserProgress     TrainingSession ── ExerciseRun ── Text
 │                                                        └── TextQuestion
 └── DiagnosticResult ── DiagnosticAnswer ── DiagnosticItem
                              └── Diagnostic
```

### Wichtige Befehle

```bash
npm run dev             # Frontend + Backend parallel starten
npm run build           # Alle Pakete bauen
npm run typecheck       # TypeScript-Prüfung (alle Workspaces)
npm run test            # Vitest-Unit-Tests (Fading, Adaptive Engine, LIX, Cloze)
npm run test:e2e        # Playwright E2E-Tests
npm run lint            # ESLint
npm run db:migrate      # Prisma-Migrationen anwenden
npm run db:seed         # Basisdaten einspielen
npm run db:studio       # Prisma Studio öffnen
```
