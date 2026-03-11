# SkyPanelV2

[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/gvps-cloud/skypanelv2)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## 🚀 GVPS Cloud Internal Management Platform

**SkyPanelV2** is the proprietary VPS management and billing platform powering **GVPSCloud's** Linode VPS reselling business. This system handles all aspects of our operations including customer management, VPS provisioning, automated billing, support ticketing, and business analytics.

> **⚠️ Internal Use Only**: This is a proprietary business system for gvpscloud operations. This documentation is intended for our internal development team and authorized personnel only.

## 📋 Table of Contents

- [System Overview](#-system-overview)
- [Architecture](#-architecture)
- [Core Features](#-core-features)
- [Development Setup](#-development-setup)
- [Deployment](#-deployment)
- [Technical Documentation](#-technical-documentation)

---

## 🏗️ System Overview

### What is SkyPanelV2?

SkyPanelV2 is gvps-cloud's complete business operations platform for managing our Linode VPS reselling business. It provides:

- **Customer Portal**: Self-service interface for customers to manage VPS instances, billing, and support
- **Admin Dashboard**: Internal tools for managing customers, VPS plans, billing, and system configuration
- **Automated Billing**: Hourly billing system with wallet-based payments and invoice generation
- **VPS Management**: Direct Linode API integration for provisioning and managing customer VPS instances
- **Support System**: Integrated ticketing system for customer support operations

### Business Operations

**Revenue Model:**
```
Linode Cost → gvps.cloud Markup → Customer Price
Example: $5/month Linode → +$5 Margin → $10/month to Customer
```

**Key Business Processes:**
- **Customer Onboarding**: Registration, wallet funding, VPS provisioning
- **Billing Operations**: Automated hourly billing, invoice generation, payment processing
- **VPS Lifecycle**: Provisioning, monitoring, backup management, decommissioning
- **Customer Support**: Ticket management, SSH console access, account management
- **Business Analytics**: Revenue tracking, usage monitoring, customer metrics

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
│  React 18 + TypeScript + Vite + shadcn/ui + TanStack Query     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Customer   │  │    Admin     │  │   Public     │         │
│  │   Portal     │  │   Dashboard  │  │    Pages     │         │
│  │              │  │              │  │              │         │
│  │ - VPS Mgmt   │  │ - User Mgmt  │  │ - Login      │         │
│  │ - Billing    │  │ - System     │  │ - Register   │         │
│  │ - Console    │  │   Config     │  │ - Pricing    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                          │
│                  Express.js + TypeScript                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   Auth   │  │   VPS    │  │ Billing  │  │  Admin   │      │
│  │ Middleware│  │ Services│  │ Services │  │ Routes   │      │
│  │          │  │          │  │          │  │          │      │
│  │ - JWT    │  │ - Create │  │ - Wallet │  │ - Users  │      │
│  │ - RBAC   │  │ - Monitor│  │ - Hourly │  │ - Orgs   │      │
│  │ - Rate   │  │ - SSH    │  │ - Invoices│  │ - Plans  │      │
│  │   Limit  │  │   Bridge │  │          │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Data & Services Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  PostgreSQL  │  │   WebSocket  │  │  External    │        │
│  │   Database   │  │   SSH Bridge │  │   APIs       │        │
│  │              │  │              │  │              │        │
│  │ - Users      │  │ - Real-time  │  │ - Linode     │        │
│  │ - VPS Inst.  │  │   Terminal  │  │ - PayPal     │        │
│  │ - Billing    │  │ - Activity   │  │ - SMTP       │        │
│  │ - Wallets    │  │   Streams    │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Architecture

### Core Components

#### **1. Frontend Layer (User Interface)**

**Customer Portal:**
- VPS instance management and monitoring
- Wallet management and payment processing
- Billing history and invoice downloads
- SSH console access
- Support ticket management

**Admin Dashboard:**
- Customer and organization management
- VPS plan configuration
- System-wide billing operations
- Support ticket management
- Platform analytics and reporting
- Provider configuration (Linode API)

**Public Pages:**
- Customer registration and login
- Pricing information
- Marketing pages

#### **2. Backend API Layer (Business Logic)**

**Authentication & Authorization:**
- JWT-based authentication
- Role-based access control (Admin, Owner, Member)
- Session management and security

**VPS Services:**
- Linode API integration for VPS operations
- Automated provisioning and decommissioning
- Real-time status monitoring
- SSH bridge for console access
- Backup management

**Billing Services:**
- Automated hourly billing cron jobs
- Wallet-based payment system
- PayPal payment processing
- Invoice generation and management
- Usage tracking and analytics

**Admin Services:**
- Customer account management
- Organization management
- VPS plan configuration
- System configuration
- Audit logging

#### **3. Data & Services Layer**

**PostgreSQL Database:**
- Customer accounts and organizations
- VPS instances and configurations
- Billing transactions and invoices
- Support tickets
- Audit logs and activity feeds

**External Integrations:**
- **Linode API**: VPS infrastructure management
- **PayPal REST API**: Payment processing
- **SMTP Services**: Email notifications
- **PostgreSQL LISTEN/NOTIFY**: Real-time updates

### Technology Stack

#### Frontend
- **React 18** - Component-based UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **React Router v7** - Client-side routing
- **shadcn/ui** - Component library
- **Tailwind CSS** - Styling framework
- **React Hook Form + Zod** - Form validation

#### Backend
- **Node.js 22.22.0** - JavaScript runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Relational database
- **JWT** - Authentication
- **WebSocket** - Real-time communication
- **SSH2** - SSH protocol implementation

#### Integrations
- **Linode/Akamai API** - VPS infrastructure
- **PayPal REST SDK** - Payment processing
- **SMTP Services** - Email delivery
- **PostgreSQL LISTEN/NOTIFY** - Real-time events

---

## ✨ Core Features

### 🖥️ VPS Management
- **Linode Integration**: Direct API integration for VPS provisioning and management
- **SSH Console Access**: Browser-based terminal with WebSocket bridge
- **Automated Provisioning**: One-click VPS deployment
- **Backup Management**: Configurable backup options with custom pricing
- **Real-time Monitoring**: Live status updates and resource tracking
- **Plan Management**: Customizable VPS plans with pricing tiers

### 💰 Billing & Payments
- **Wallet System**: Prepaid wallet with automatic balance deduction
- **Hourly Billing**: Automated cron-based billing system
- **PayPal Integration**: Payment processing with webhook support
- **Invoice Generation**: Automatic invoice creation with PDF downloads
- **Payment History**: Complete transaction tracking
- **Usage Analytics**: Resource usage and cost analysis

### 👥 Customer & Organization Management
- **Multi-tenant Architecture**: Organization-based data separation
- **Role-based Permissions**: Admin, owner, and member roles
- **Customer Management**: Comprehensive admin interface for customer accounts
- **Organization Workflows**: CRUD operations with validation
- **Member Management**: Team member management within organizations
- **Impersonation**: Admin support capability

### 🔐 Security & Authentication
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Tiered API rate limits
- **Password Security**: Bcrypt hashing
- **Access Control**: Role-based permissions
- **Audit Logging**: Activity tracking for compliance

### ⚡ Real-Time Features
- **Live Notifications**: PostgreSQL LISTEN/NOTIFY with SSE
- **SSH Terminal**: Real-time terminal access
- **Activity Feeds**: Live activity streams
- **Status Updates**: Real-time VPS monitoring

### 🛠️ Admin Features
- **Dashboard**: System overview with metrics
- **User Management**: Customer account administration
- **Organization Management**: Multi-tenant organization control
- **Provider Configuration**: Linode API token management
- **Platform Settings**: System configuration and branding
- **Support System**: Ticket management
- **FAQ Management**: Knowledge base administration

### 📱 Modern UI/UX
- **Responsive Design**: Mobile-first approach
- **Accessibility**: ARIA-compliant components
- **Dark/Light Themes**: Multiple theme presets
- **Modal-based Interactions**: Enhanced dialogs
- **Loading States**: Proper feedback and error handling

---

## 🚀 Development Setup

### Prerequisites

- **Node.js 22.22.0 (npm 9+)** - [Download](https://nodejs.org/)
- **PostgreSQL 12+** - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)

### Required API Keys

- **Linode API Token** - From Linode account settings
- **PayPal Client ID & Secret** - From PayPal Developer Dashboard
- **SMTP Credentials** - For email notifications

### Quick Start

#### 1. Clone Repository

```bash
git clone https://github.com/gvps-cloud/skypanelv2.git
cd skypanelv2
npm install
```

#### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Generate encryption secret
node scripts/generate-ssh-secret.js
```

Edit `.env` with required values:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
SSH_CRED_SECRET=generated-by-script-above
ENCRYPTION_KEY=your-32-character-encryption-key

# PayPal
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Linode
LINODE_API_TOKEN=your-linode-api-token

# Branding
VITE_COMPANY_NAME=gvps.cloud
COMPANY_NAME=gvps.cloud
```

#### 3. Setup Database

```bash
# Reset database and apply migrations
npm run db:fresh

# Create admin user
npm run seed:admin
```

**Default Admin Credentials:**
- Email: `admin@skypanelv2.com`
- Password: `admin123`

#### 4. Start Development

```bash
# Start both frontend and backend
npm run dev
```

Access the platform:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Development Commands

```bash
# Development
npm run dev              # Start frontend + backend
npm run client:dev       # Frontend only
npm run server:dev       # Backend only

# Database
npm run db:fresh         # Reset and migrate
npm run db:reset         # Interactive reset
npm run seed:admin       # Create admin user

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run lint             # Lint code
npm run check            # Type check

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run pm2:start        # Start with PM2
```

### Project Structure

```
skypanelv2/
├── api/                          # Backend API (Express.js)
│   ├── routes/                   # API route definitions
│   │   ├── admin/               # Admin endpoints
│   │   ├── auth.ts              # Authentication
│   │   ├── vps.ts               # VPS management
│   │   └── payments.ts          # Payment processing
│   ├── services/                # Business logic
│   │   ├── linodeService.ts     # Linode integration
│   │   ├── billingService.ts    # Billing logic
│   │   ├── emailService.ts      # Email notifications
│   │   └── ...
│   ├── middleware/              # Express middleware
│   │   ├── auth.ts              # JWT authentication
│   │   ├── rateLimiting.ts      # Rate limiting
│   │   └── security.ts          # Security headers
│   └── lib/                     # Utilities
├── src/                          # Frontend (React)
│   ├── components/              # React components
│   │   ├── ui/                 # Base components
│   │   ├── admin/              # Admin components
│   │   └── layouts/            # Layout components
│   ├── pages/                   # Page components
│   ├── contexts/                # React contexts
│   ├── services/                # API clients
│   └── lib/                     # Frontend utilities
├── migrations/                   # Database migrations
├── scripts/                     # Utility scripts
└── public/                      # Static assets
```

---

## 🚀 Deployment

### Production Checklist

#### Security
- [ ] Strong JWT secret (32+ characters)
- [ ] Secure database password
- [ ] HTTPS/SSL configured
- [ ] PayPal live credentials
- [ ] `NODE_ENV=production`
- [ ] Rate limiting configured
- [ ] Database backups enabled

#### Configuration
- [ ] Linode production API token
- [ ] Production SMTP credentials
- [ ] `CLIENT_URL` set to production domain
- [ ] CORS origins configured
- [ ] `TRUST_PROXY=1` if behind proxy

#### Testing
- [ ] Payment flow tested
- [ ] VPS provisioning tested
- [ ] Email delivery verified
- [ ] Admin panel functionality verified

### Deployment with PM2

```bash
# Clone and setup
git clone https://github.com/gvps-cloud/skypanelv2.git
cd skypanelv2
npm install

# Configure environment
cp .env.example .env
# Edit .env with production values

# Setup database
npm run db:fresh
npm run seed:admin

# Build and start
npm run build
npm run pm2:start

# Monitor
pm2 monit
pm2 logs skypanelv2
```

### SSL Configuration

```bash
# Setup Caddy reverse proxy with SSL
sudo bash scripts/setup-caddy-ssl.sh \
  --domain panel.gvps.cloud \
  --email admin@gvps.cloud \
  --install-caddy
```

### Monitoring & Maintenance

```bash
# Health check
curl https://panel.gvps.cloud/api/health

# PM2 status
pm2 list
pm2 logs

# Database backup
pg_dump skypanelv2 > backup_$(date +%Y%m%d).sql

# Updates
git pull origin main
npm install
npm run build
npm run pm2:reload
```

---

## 📚 Technical Documentation

### API Documentation

**Core References:**
- **[API Reference](./api-docs/README.md)** - Complete API documentation
- **[Admin API](./api-docs/admin/README.md)** - Administrative operations
- **[Authentication](./api-docs/auth.md)** - Auth flow documentation

**Feature Documentation:**
- **[Organization Management](./api-docs/admin/organizations.md)** - Organization operations
- **[Member Management](./api-docs/admin/organization-members.md)** - Member operations
- **[User Management](./api-docs/admin/user-detail.md)** - User account management
- **[VPS Management](./repo-docs/MULTI_PROVIDER_VPS.md)** - VPS operations
- **[Backup Pricing](./repo-docs/FLEXIBLE_BACKUP_PRICING_API.md)** - Backup configuration

### Configuration Guides

- **[Environment Variables](./repo-docs/ENVIRONMENT_VARIABLES.md)** - Configuration reference
- **[SSL Setup](./repo-docs/SSL_SETUP.md)** - HTTPS configuration
- **[Development Setup](./CLAUDE.md)** - Development guidelines

### Architecture Documentation

- **[Database Schema](./repo-docs/DATABASE_SCHEMA.md)** - Database structure
- **[Service Architecture](./repo-docs/SERVICES.md)** - Backend patterns
- **[Frontend Patterns](./repo-docs/FRONTEND.md)** - Frontend architecture

### Development Resources

- **[Agent Instructions](./AGENTS.md)** - AI agent guidelines
- **[GitHub Copilot Instructions](./.github/copilot-instructions.md)** - Copilot configuration

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Specific test file
npm test -- vps.test.ts

# With coverage
npm test -- --coverage
```

### Quality Checks

```bash
# Type checking
npm run check

# Linting
npm run lint

# Fix linting issues
npm run lint -- --fix

# Build verification
npm run build
```

---

## 🔐 Security

### Data Protection

**Encryption:**
- SSH credentials: AES-256 encryption
- API tokens: AES-256 encryption
- Passwords: Bcrypt hashing
- JWT tokens: Signed with secret key

**Transport Security:**
- HTTPS/TLS for all communications
- WebSocket over secure connection (WSS)
- Database connection over SSL

**Access Control:**
- Role-based permissions
- JWT authentication
- Rate limiting
- Audit logging

### Rate Limiting

- **Anonymous**: 200 requests / 15 minutes
- **Authenticated**: 500 requests / 15 minutes
- **Admin**: 1000 requests / 15 minutes

---

## 📞 Internal Contacts

**Development Team:**
- Technical issues and bug reports
- Feature requests and enhancements
- Code reviews and pull requests

**Operations Team:**
- Production deployment
- System monitoring
- Database management

**Support Team:**
- Customer issues
- Billing inquiries
- VPS provisioning support

---

## 📄 License

This is proprietary software owned by gvps.cloud. All rights reserved.

**Confidential**: This codebase and documentation are confidential and proprietary to gvps.cloud. Unauthorized access, use, or distribution is prohibited.

---

**Built and maintained by the gvps.cloud development team**
