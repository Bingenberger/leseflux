# Leseflux

Tablet-optimierte WebApp zum Training der Leseflüssigkeit (Klasse 2–4) via **Constant Fading**.

## Lokale Entwicklung

```bash
# 1. Voraussetzungen: Docker, Node 20, npm 10
cp .env.example .env
# DATABASE_URL und JWT_SECRET in .env eintragen

# 2. Datenbank starten
docker-compose up -d postgres

# 3. Abhängigkeiten installieren
npm install

# 4. Datenbank migrieren und befüllen
npm run db:migrate
npm run db:seed

# 5. Dev-Server starten (Frontend + Backend parallel)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Demo-Lehrer: `demo@leseflux.schule` / `Lehrer1234!`
- Demo-Schüler QR-Token: wird beim ersten `npm run db:seed` ausgegeben

## Texte importieren

```bash
npm run seed:texts -- ./texte/klasse-2.json
```

JSON-Format:
```json
[
  {
    "title": "Der Drache im Garten",
    "content": "Mia lief durch den Garten...",
    "targetLevel": 2,
    "questions": [
      { "question": "Wo läuft Mia?", "options": ["Im Garten", "Im Wald"], "correctIndex": 0 }
    ]
  }
]
```

## Tests ausführen

```bash
npm run test           # Vitest (Fading-Algorithmus, Adaptiv-Engine, LIX)
npm run test:e2e       # Playwright E2E
```

## Produktion

```bash
docker-compose up -d   # startet postgres + api + web + nginx
```

TLS: Let's Encrypt-Zertifikate nach `nginx/certs/` legen (`fullchain.pem`, `privkey.pem`).

## Architektur

```
apps/web      React 18 + Vite + Tailwind  (Port 5173 / 80)
apps/api      Fastify + Prisma            (Port 3001)
packages/shared  Zod-Schemas + Algorithmen (gemeinsam genutzt)
```

Kinder melden sich per QR-Code an (SHA-256 gehasht, kein Klartext gespeichert).  
Lehrer/Admins melden sich per E-Mail + Passwort (argon2) an.

Adaptiv-Engine-Schwellenwerte: `apps/api/src/config.ts`

## Entwicklungsphasen

| Phase | Status |
|---|---|
| 1 – MVP (Auth, Reader, Quiz, Lehrer-Dashboard) | ✅ |
| 2 – Diagnostik + Adaptiv-Engine | 🔲 |
| 3 – LRS-Modus, Silbenfärbung, Texte-Upload | 🔲 |
| 4 – Gamification, DSGVO-Export, QR-PDF | 🔲 |
