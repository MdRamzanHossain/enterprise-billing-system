# Enterprise Invoicing, POS & Business Management System

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B%20LTS-brightgreen.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Node%20Core)-blue.svg?style=flat-square)](#architecture--design-philosophy)
[![Docker Support](https://img.shields.io/badge/Docker-Ready%20(Multi--Stage)-2496ED.svg?style=flat-square&logo=docker)](Dockerfile)
[![Frontend](https://img.shields.io/badge/Frontend-ES6%2B%20%7C%20TailwindCSS-38B2AC.svg?style=flat-square&logo=tailwind-css)](public/)
[![License](https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square)](LICENSE)

An enterprise-grade, high-performance web application designed for retail, wholesale, and multi-branch commercial enterprises. Built with a pure Node.js core architecture featuring zero external runtime dependencies, native A4 print rendering, dynamic Role-Based Access Control (RBAC), multi-tenant company profiles, atomic file persistence, and an interactive theme customization studio.

---

## Architecture & Design Philosophy

```
+-----------------------------------------------------------------------------+
|                                Client Layer                                 |
|   Vanilla ES6+ SPA  |  Tailwind CSS Engine  |  html2pdf Vector Exporter     |
+-----------------------------------------------------------------------------+
                                       |
                             RESTful JSON HTTP / 1.1
                                       |
+-----------------------------------------------------------------------------+
|                             Application Layer                               |
|   Pure Node.js HTTP Server  |  Token Auth Engine  |  RBAC Permission Matrix |
|   Path Normalizer (Proxy)   |  Audit Logging      |  Number-to-Words Engine |
+-----------------------------------------------------------------------------+
                                       |
                              Atomic Storage I/O
                                       |
+-----------------------------------------------------------------------------+
|                              Persistence Layer                              |
|   Atomic JSON Storage (.tmp swap)  |  Soft-Delete Recycle Bin Audit Trail   |
+-----------------------------------------------------------------------------+
```

### 1. Zero External Runtime Dependencies
The backend service is engineered using Node.js standard runtime libraries (`http`, `fs`, `path`, `crypto`, `url`). By intentionally avoiding external frameworks and micro-libraries:
- **Zero Supply-Chain Vulnerabilities**: No nested `node_modules` attack surfaces or dependency deprecation risks.
- **Microsecond Cold Starts**: Instant daemon boot times (<50ms) with minimal memory footprint (~30MB RSS).
- **Universal Portability**: Runs natively across Linux VPS, Docker containers, Alpine images, macOS, Windows, and shared cPanel environments without package installation overhead.

### 2. Atomic Persistence Engine
To prevent data corruption during unexpected server interruptions, writes are processed through an atomic write pattern:
- Serialized data writes first to a timestamped temporary swap file (`<file>.<timestamp>.tmp`).
- Atomic rename operation (`fs.renameSync`) replaces the active dataset in a single POSIX-compliant filesystem operation.

### 3. Native Print Engine & Calibrated A4 Rendering
Unlike traditional web dashboards that produce distorted browser prints, this platform features a dedicated print stylesheet calibrated for standard **A4 portrait (210mm x 297mm)**:
- Exact physical millimeter margins and overflow guards.
- Automatic pagination control with dynamic signature block positioning.
- Seamless dual-mode output: direct physical browser printing or client-side vector PDF generation with automatic filename formatting.

---

## Core Features

### 🏢 Multi-Company & Tenant Profiles
- Maintain independent business profiles with discrete company names, taglines, physical addresses, phone lines, emails, and custom logos.
- Configurable per-company invoice and sales order prefix codes (e.g., `INV-MT-`, `SO-WTI-`).
- Set a default active company or toggle between branches dynamically when issuing bills.

### 🧾 Comprehensive Invoicing & POS Engine
- **Itemized Ledger**: Real-time line-item calculation (Unit Price x Quantity) with warranty period tagging.
- **Financial Breakdown**: Comprehensive adjustments including subtotal, trade discount, VAT, Advance Income Tax (AIT), and ancillary charges.
- **Accounts Receivable Tracking**: Real-time closing balance computation with automated payment status classification (`Paid`, `Partial`, `Due`).
- **Bangladeshi Taka (BDT) Words Engine**: Native currency-to-words algorithm transcribing totals into official Taka and Poisha verbiage.

### 🛡️ Dynamic Role-Based Access Control (RBAC)
- Fine-grained permission matrix with 16 distinct functional privileges across billing, inventory, administrative management, and design customization.
- Create and assign custom operational roles (e.g., *Billing Manager*, *Cashier*, *Inventory Officer*, *Auditor*).
- Real-time client and server permission guards enforcing access control on all endpoints and interface controls.

### 📦 Inventory Auto-Cataloging
- Automatic catalog discovery: items typed during manual billing that do not exist in the inventory are automatically cataloged with baseline prices and warranty details.
- Dedicated product catalog view with instant search, price editing, and category management.

### ♻️ Soft Delete & Recycle Bin Audit Trail
- Non-destructive record lifecycle: deleted invoices and products move to an audited **Trash Box**.
- Records capture user attribution (`deletedBy`) and precise deletion timestamps.
- One-click record restoration or permanent administrative purge.

### 🎨 Theme Customization Studio
- Live WYSIWYG theme editor for modifying the authentication gateway and application workspace.
- Configurable preset palettes (*Midnight Navy*, *Emerald Forest*, *Royal Violet*, *Cyber Slate*, *Crimson Minimal*).
- Real-time gradient customization, typography adjustment, logo upload, and glassmorphism backdrop blur controls.

---

## System Architecture & File Structure

```
.
├── server.js                  # Pure Node.js HTTP server, routing, RBAC, API endpoints
├── app.js                     # Root entrypoint proxy (cPanel / Phusion Passenger)
├── package.json               # Project manifest and standard npm lifecycle scripts
├── start.bat                  # One-click Windows startup script
├── Dockerfile                 # Multi-stage production container image (Node 20 Alpine)
├── docker-compose.yml         # Containerized production stack with volume persistence
├── nginx.conf                 # Production reverse proxy configuration with SSL termination
├── ecosystem.config.js        # PM2 cluster and process management definition
├── sec-gadgets.service        # Systemd Linux daemon unit configuration
├── DEPLOYMENT.md              # Comprehensive production deployment documentation
├── data/                      # Atomic persistent JSON datastore
│   ├── companies.json         # Company profiles, branding, and prefix settings
│   ├── invoices.json          # Master billing records and line-item history
│   ├── products.json          # Product inventory catalog
│   ├── roles.json             # RBAC role definitions and permission matrices
│   ├── settings.json          # Global system parameters
│   ├── theme.json             # Visual design and login studio configuration
│   ├── trash.json             # Audited recycle bin soft-delete records
│   └── users.json             # User accounts and cryptographic password hashes
└── public/                    # Frontend client assets
    ├── index.html             # Single-Page Application container
    ├── style.css              # Custom CSS, glassmorphism, and A4 print styling
    ├── app.js                 # Frontend SPA router, state manager, views, and print logic
    ├── logo_data.js           # Default branding asset fallback
    ├── logo.png               # Brand icon asset
    └── logo.svg               # Vector brand mark
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or later (v20 LTS recommended).

### Local Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/sec-gadgets.git
cd sec-gadgets

# Start the application
npm start
# or: node server.js
```

The application will bind to `http://localhost:3000`.

### Docker Deployment
```bash
# Launch via Docker Compose
docker compose up -d

# Verify container health
docker compose ps
curl http://localhost:3000/health
```

---

## Pre-Configured Demo Accounts

| Role | Username | Password | Operational Access Level |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `admin123` | Unrestricted superuser access across all modules |
| **Executive Administrator** | `ramzan` | `admin123` | Complete administrative and user management control |
| **Sales / Billing Staff** | `tarek` | `tarek123` | Invoice creation, billing ledger, inventory search, PDF export |
| **Account Auditor** | `viewer` | `viewer123` | Read-only inspection and invoice print/download rights |

---

## REST API Specification

### Authentication
- `POST /api/auth/login` - Authenticate credentials and establish session token.
- `POST /api/auth/logout` - Invalidate active session.
- `GET /api/auth/me` - Retrieve current session identity and role permissions.

### Invoices & Billing
- `GET /api/invoices` - Retrieve billing records with search and pagination filters.
- `GET /api/invoices/next-numbers` - Retrieve auto-incremented invoice and sales order IDs.
- `POST /api/invoices` - Create and commit a new invoice record.
- `PUT /api/invoices/:id` - Update existing invoice details.
- `DELETE /api/invoices/:id` - Soft-delete invoice into the Recycle Bin.

### Companies & Branding
- `GET /api/companies` - List all configured tenant company profiles.
- `POST /api/companies` - Register a new company profile with custom logo.
- `PUT /api/companies/:id` - Modify company information and branding.
- `POST /api/companies/:id/set-default` - Designate default company profile.
- `DELETE /api/companies/:id` - Remove company profile.

### Inventory & Products
- `GET /api/products` - List inventory items.
- `POST /api/products` - Create new inventory item.
- `PUT /api/products/:id` - Update product details, warranty, or pricing.
- `DELETE /api/products/:id` - Move product to Recycle Bin.

### Data Protection & Administration
- `GET /api/trash` - Retrieve soft-deleted items with audit metadata.
- `POST /api/trash/restore` - Restore record to active database.
- `DELETE /api/trash/:id` - Permanently purge specific trash record.
- `DELETE /api/trash` - Empty recycle bin.
- `GET /api/stats` - Summary analytics (Total Sales, Outstanding Due, Record Counts).
- `GET /api/theme` / `PUT /api/theme` - Read and update visual theme presets.
- `GET /health` - Service health, uptime, and system diagnostics.

---

## Production Deployment

Comprehensive instructions for deploying to **Linux VPS (PM2 + Nginx)**, **Docker / Kubernetes**, **PaaS (Render, Railway)**, and **cPanel (CloudLinux Phusion Passenger)** are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## License

This project is licensed under the [MIT License](LICENSE).
