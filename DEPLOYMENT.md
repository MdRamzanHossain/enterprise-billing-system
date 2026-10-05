# Production Deployment Guide: Master Technology Billing System

This application is built with **zero external runtime dependencies** (using Node.js core modules), making it exceptionally fast, secure, lightweight, and compatible with almost any server, container, or cloud host.

---

## Table of Contents
1. [Pre-Requisites](#pre-requisites)
2. [Option 1: Linux VPS (Ubuntu / Debian) with PM2 & Nginx (Recommended)](#option-1-linux-vps-ubuntu--debian-with-pm2--nginx)
3. [Option 2: Docker & Docker Compose (Containerized)](#option-2-docker--docker-compose)
4. [Option 3: Cloud PaaS (Render, Railway, Fly.io)](#option-3-cloud-paas-render-railway-flyio)
5. [Option 4: cPanel Hosting (Node.js App Selector)](#option-4-cpanel-hosting)
6. [Post-Deployment Security & Backup Checklist](#post-deployment-security--backup-checklist)

---

## Pre-Requisites
- **Node.js**: v18.0.0 or later (v20 LTS recommended).
- **Server Port**: Port `3000` (or custom `PORT` via environment variable).
- **Disk Storage**: Write permissions for the `./data` directory (stores invoices, products, companies, users, roles, trash).

---

## Option 1: Linux VPS (Ubuntu / Debian) with PM2 & Nginx

This is the standard, battle-tested setup for production business applications.

### Step 1: Install Node.js & Tools
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git

# Verify Node installation
node -v   # Should be v20.x or higher
npm -v

# Install PM2 process manager globally
sudo npm install -g pm2
```

### Step 2: Deploy Project Files
```bash
# Create application directory
sudo mkdir -p /var/www/sec-gadgets
sudo chown -R $USER:$USER /var/www/sec-gadgets

# Upload or copy project files into /var/www/sec-gadgets
# Ensure data directory has write permissions
chmod -R 775 /var/www/sec-gadgets/data
```

### Step 3: Configure Environment
```bash
cd /var/www/sec-gadgets
cp .env.example .env
# Edit .env if needed (PORT=3000, HOST=127.0.0.1 behind Nginx)
```

### Step 4: Start with PM2 Process Manager
```bash
cd /var/www/sec-gadgets

# Start using the included ecosystem file
pm2 start ecosystem.config.js

# Save PM2 process list and configure to start automatically on server reboot
pm2 save
pm2 startup
# (Run the sudo env PATH=... command that pm2 outputs)

# Check status
pm2 status
pm2 logs sec-gadgets-billing
```

### Step 5: Configure Nginx & Domain
```bash
# Copy the provided nginx configuration
sudo cp /var/www/sec-gadgets/nginx.conf /etc/nginx/sites-available/sec-gadgets

# Edit with your actual domain name:
sudo nano /etc/nginx/sites-available/sec-gadgets
# Replace "your-domain.com" with your actual domain or VPS IP

# Enable the site and test configuration
sudo ln -s /etc/nginx/sites-available/sec-gadgets /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Enable Free SSL (HTTPS) with Let's Encrypt
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
Certbot will automatically renew your certificates.

---

## Option 2: Docker & Docker Compose

Deploy the complete application in an isolated, production-ready container with 1 command.

### Step 1: Install Docker & Docker Compose
Ensure Docker Engine and Docker Compose are installed on your server:
```bash
docker --version
docker compose version
```

### Step 2: Launch Container
```bash
# In the project root directory:
docker compose up -d --build
```

### Step 3: Verify Container Health
```bash
docker compose ps
docker compose logs -f billing-app
curl http://localhost:3000/health
```

### Volume Persistence
The `./data` folder is mounted from the host into `/app/data`. All invoices, user accounts, products, and uploaded company logos persist safely on your host server even when containers restart or rebuild.

---

## Option 3: Cloud PaaS (Render, Railway, Fly.io)

### Render.com (Web Service)
1. Push your repository to **GitHub** or **GitLab**.
2. Create a new **Web Service** on Render and connect your repository.
3. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: *(leave empty)*
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/health`
4. Add a **Persistent Disk** (Render Disks):
   - Mount Path: `/app/data` (or set `DATA_DIR=/var/data` in Environment Variables).

### Railway.app
1. Click **New Project** -> **Deploy from GitHub repo**.
2. Add a persistent **Volume** mounted at `/app/data`.
3. Railway automatically detects `npm start` and exposes your domain.

### Fly.io
```bash
# Install flyctl
fly launch
# Attach persistent storage volume:
fly volumes create sec_gadgets_data --size 1
# In fly.toml, mount volume to /app/data
fly deploy
```

---

## Option 4: cPanel Hosting (Node.js App Selector)

If your host provides cPanel with **Setup Node.js App** (CloudLinux Passenger):
1. In cPanel, click **Setup Node.js App**.
2. Click **Create Application**:
   - **Node.js version**: Choose `20.x` or latest available `18.x+`.
   - **Application mode**: `Production`.
   - **Application root**: `sec-gadgets` (upload project files here).
   - **Application startup file**: `server.js`.
3. Upload all files into the application directory.
4. Ensure folder permissions on the `data/` directory are `755` or `775`.
5. Click **Restart** or **Run JS script**.

---

## Post-Deployment Security & Backup Checklist

### 1. Change Default User Passwords Immediately
Log in to your live system and change default credentials:
- **Default Admin**: `admin` / `admin123` *(Change password in User Management)*
- **Default Sales**: `tarek` / `tarek123`

### 2. Verify Health Monitoring Endpoint
Cloud balancers and uptime monitors (e.g., UptimeRobot, BetterUptime) can monitor:
```http
GET https://your-domain.com/health
```
Returns:
```json
{
  "status": "ok",
  "uptime": 12450,
  "timestamp": "2026-10-04T12:00:00.000Z",
  "service": "sec-gadgets-billing",
  "version": "1.0.0"
}
```

### 3. Automated Daily Data Backups (Cron Job)
Create a quick daily automated backup of the `./data` directory:
```bash
sudo crontab -e
```
Add this line to back up data every night at 2:00 AM:
```bash
0 2 * * * tar -czf /var/backups/sec-gadgets-$(date +\%F).tar.gz -C /var/www/sec-gadgets data
```

---

## Summary of Deployment Files Provided

| File | Purpose |
| :--- | :--- |
| `server.js` | Zero-dependency production HTTP server with security headers & graceful shutdown |
| `package.json` | Defines start scripts (`npm start`) and Node engine specifications |
| `Dockerfile` | Production container image (Node 20 Alpine, non-root user, healthcheck) |
| `docker-compose.yml` | 1-command container deployment with persistent storage mapping |
| `.dockerignore` | Prevents unnecessary files from bloating docker builds |
| `ecosystem.config.js` | PM2 process configuration for production Linux VPS |
| `nginx.conf` | Nginx reverse proxy configuration with gzip, SSL & 20MB body size |
| `sec-gadgets.service` | Linux Systemd service unit template |
| `.env.example` | Template for environment variables (`PORT`, `HOST`, `DATA_DIR`) |
| `.gitignore` | Prevents logs, secrets, and temp files from being committed |
