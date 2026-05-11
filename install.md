# Lesefluss – Serverinstallation (Ubuntu)

Diese Anleitung beschreibt die vollständige Installation auf einem frischen Ubuntu-Server (22.04 LTS oder 24.04 LTS).

---

## Voraussetzungen

| Anforderung | Mindest |
|---|---|
| Ubuntu | 22.04 LTS oder 24.04 LTS |
| RAM | 1 GB (2 GB empfohlen) |
| Festplatte | 10 GB frei |
| Öffentliche IP | ja |
| Domain | ja (z. B. `lesefluss.meine-schule.de`) |
| Ports | 80 und 443 müssen erreichbar sein |

---

## Schritt 1 – System vorbereiten

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
```

Firewall einrichten:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Schritt 2 – Docker installieren

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Danach **neu anmelden** (oder `newgrp docker`), damit die Gruppenmitgliedschaft wirksam wird.

Docker Compose ist seit Docker v2 bereits enthalten. Versionen prüfen:

```bash
docker --version          # Erwartet: 25 oder höher
docker compose version    # Erwartet: v2.x
```

---

## Schritt 3 – Repository klonen

```bash
git clone <repo-url> /opt/lesefluss
cd /opt/lesefluss
```

---

## Schritt 4 – Umgebungsvariablen anlegen

```bash
cp .env.example .env
nano .env
```

Folgende Werte **zwingend anpassen**:

```env
# Datenbankpasswort – langes, zufälliges Passwort wählen
POSTGRES_PASSWORD=sicheres_langes_datenbankpasswort

# JWT-Schlüssel – mindestens 32 zufällige Zeichen
JWT_SECRET=zufaelliger_string_mindestens_32_zeichen

# Wird von Docker intern aufgebaut – nicht ändern
DATABASE_URL=postgresql://leseflux:${POSTGRES_PASSWORD}@postgres:5432/leseflux

# Produktionsmodus
NODE_ENV=production
```

Einen sicheren Zufallsstring erzeugen:

```bash
openssl rand -base64 48
```

---

## Schritt 5 – TLS-Zertifikat einrichten (Let's Encrypt)

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d lesefluss.meine-schule.de
```

> Port 80 muss für die ACME-Challenge frei sein. Docker darf zu diesem Zeitpunkt **noch nicht laufen**.

Zertifikate in den Nginx-Ordner kopieren:

```bash
sudo cp /etc/letsencrypt/live/lesefluss.meine-schule.de/fullchain.pem /opt/lesefluss/nginx/certs/
sudo cp /etc/letsencrypt/live/lesefluss.meine-schule.de/privkey.pem   /opt/lesefluss/nginx/certs/
sudo chown $USER:$USER /opt/lesefluss/nginx/certs/*.pem
```

Nginx-Konfiguration anpassen:

```bash
nano /opt/lesefluss/nginx/nginx.conf
```

Den Eintrag `server_name _;` in beiden `server`-Blöcken auf die echte Domain setzen:

```nginx
server_name lesefluss.meine-schule.de;
```

---

## Schritt 6 – Images bauen und App starten

```bash
cd /opt/lesefluss
docker compose build
docker compose up -d
```

Status prüfen (alle Container sollten `Up` oder `healthy` zeigen):

```bash
docker compose ps
```

---

## Schritt 7 – Datenbank migrieren und Basisdaten einspielen

Migrationen anwenden:

```bash
docker compose exec api npx prisma migrate deploy
```

Basisdaten einspielen (Demo-Lehrkraft, Diagnostiksätze):

```bash
docker compose exec api node dist/scripts/seed.js
```

> Die Demo-Zugangsdaten (E-Mail und QR-Token) werden im Terminal ausgegeben.

---

## Schritt 8 – Trainingsinhalte importieren

Im Repository liegen fertige Inhalte unter `packages/text/`:

```bash
# Lesetexte importieren
docker compose exec api node dist/scripts/seedTexts.js /app/packages/text/texte.json

# Wortblitz-Wörter importieren
docker compose exec api node dist/scripts/seedFlashWords.js
```

Alternativ können Texte und Wörter nach dem Login im **Admin-Dashboard** über den Menüpunkt
**Texte** bzw. **Wortblitz** als JSON-Datei hochgeladen werden.

---

## Schritt 9 – Installation prüfen

Die App sollte jetzt unter `https://lesefluss.meine-schule.de` erreichbar sein.

```bash
curl -I https://lesefluss.meine-schule.de
# HTTP/2 200 erwartet
```

Login mit den Demo-Zugangsdaten aus Schritt 7 testen.

---

## Variante: Server mit bestehendem nginx

Läuft auf dem Server bereits ein nginx (z. B. für einen anderen Dienst), kollidiert der
Lesefluss-nginx-Container mit Port 80/443. In diesem Fall den nginx-Container deaktivieren
und den vorhandenen Host-nginx als Reverse Proxy verwenden.

### a) Docker-Compose-Override anlegen

Datei `/opt/lesefluss/docker-compose.override.yml`:

```yaml
services:
  api:
    ports:
      - "127.0.0.1:3001:3001"

  web:
    ports:
      - "127.0.0.1:3002:80"

  nginx:
    profiles:
      - disabled   # nginx-Container wird nie gestartet
```

```bash
docker compose up -d   # nginx-Container erscheint nicht mehr
```

### b) TLS-Zertifikat für die Lesefluss-Domain holen

```bash
sudo certbot --nginx -d lesefluss.meine-schule.de
```

### c) nginx-Serverblock hinzufügen

Datei `/etc/nginx/sites-available/lesefluss`:

```nginx
server {
    listen 80;
    server_name lesefluss.meine-schule.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name lesefluss.meine-schule.de;

    ssl_certificate     /etc/letsencrypt/live/lesefluss.meine-schule.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lesefluss.meine-schule.de/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location /api/ {
        proxy_pass             http://127.0.0.1:3001;
        proxy_set_header       Host $host;
        proxy_set_header       X-Real-IP $remote_addr;
        proxy_set_header       X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header       X-Forwarded-Proto $scheme;
        proxy_read_timeout     60s;
    }

    location / {
        proxy_pass         http://127.0.0.1:3002;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lesefluss /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Die automatische Zertifikatserneuerung übernimmt certbot selbst (systemd-Timer wird bei
der Installation eingerichtet); kein manueller Cron nötig.

---

## Automatische Zertifikatserneuerung (Standalone-Installation)

Nur erforderlich, wenn **kein** Host-nginx läuft (Standalone-Modus aus Schritt 5).
Let's-Encrypt-Zertifikate laufen nach 90 Tagen ab:

```bash
sudo crontab -e
```

Folgende Zeile hinzufügen:

```cron
0 3 * * * certbot renew --quiet --pre-hook "docker compose -f /opt/lesefluss/docker-compose.yml stop nginx" --post-hook "cp /etc/letsencrypt/live/lesefluss.meine-schule.de/*.pem /opt/lesefluss/nginx/certs/ && docker compose -f /opt/lesefluss/docker-compose.yml start nginx"
```

---

## Updates einspielen

```bash
cd /opt/lesefluss
git pull
docker compose build
docker compose up -d
docker compose exec api npx prisma migrate deploy
```

---

## Datenbank-Backup

```bash
docker compose exec postgres pg_dump -U leseflux leseflux > backup_$(date +%F).sql
```

Backup einspielen:

```bash
docker compose exec -T postgres psql -U leseflux leseflux < backup_2026-05-11.sql
```

---

## Logs ansehen

```bash
docker compose logs -f api      # Backend-Logs
docker compose logs -f web      # Frontend-Nginx-Logs
docker compose logs -f nginx    # Reverse-Proxy-Logs
docker compose logs -f postgres # Datenbank-Logs
```

---

## Problemlösung

| Symptom | Mögliche Ursache |
|---|---|
| Container startet nicht | `.env` fehlt oder `JWT_SECRET` nicht gesetzt |
| 502 Bad Gateway | API-Container läuft noch nicht (`docker compose ps` prüfen) |
| Zertifikatsfehler | Pfade in `nginx/certs/` oder `nginx.conf` falsch |
| Datenbank-Verbindungsfehler | `POSTGRES_PASSWORD` in `.env` stimmt nicht mit gespeichertem Volume überein |
| Ports 80/443 nicht erreichbar | UFW-Regeln oder Cloud-Sicherheitsgruppen prüfen |

Bei Datenbankproblemen nach einem fehlgeschlagenen Start: Volume löschen und neu beginnen (dabei gehen **alle Daten verloren**):

```bash
docker compose down -v
docker compose up -d
# dann Schritt 7 und 8 wiederholen
```
