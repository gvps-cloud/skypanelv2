# SkyPanelV2

[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/skyvps360/skypanelv2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## 🚀 SkyPanelV2 - Cloud Service Billing Platform

**SkyPanelV2** is an open-source, white-label cloud service billing panel that provides a complete control plane for cloud hosting businesses. It enables service providers to offer VPS hosting services through a unified interface with integrated billing, customer management, and comprehensive administrative tools.

> **⚠️ Important**: This is a standalone billing and management platform, **NOT** a reseller panel. You must have your own infrastructure provider accounts (Linode, etc.) to use this system.

### 🎯 What Makes SkyPanelV2 Different?

Unlike traditional reseller panels, SkyPanelV2 gives you **complete control** over your cloud business:
- **White-label branding** - Your company, your identity
- **Direct infrastructure access** - Connect directly to providers like Linode
- **Custom pricing models** - Set your own rates and margins
- **Automated billing** - Hourly billing with wallet-based payments
- **Multi-tenant architecture** - Serve multiple customers from one platform

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [Getting Started](#-getting-started)
- [Development Guide](#-development-guide)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)

---

## 🏗️ Architecture Overview

### 📖 What is SkyPanelV2?

**SkyPanelV2** is a **complete billing and management platform** for cloud service providers. Think of it as your own "DigitalOcean" or "Linode dashboard" - but white-labeled and controlled by you.

**Key Concept**: You own the customer relationship, billing, and branding. We provide the platform to manage infrastructure, billing, and customer operations.

### 🎯 Business Model

**How You Make Money:**
```
Your Cost from Provider → Your Markup → Customer Price
Example: $5/month Linode → +$5 Your Margin → $10/month to Customer
```

**Revenue Streams:**
- **VPS Hosting**: Resell cloud infrastructure with your pricing
- **Backup Services**: Additional revenue from backup configurations
- **Wallet Prepayments**: Customers preload wallets → better cash flow
- **Value-Added Services**: SSH access, monitoring, support

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
│  │ - Billing    │  │ - Activity   │  │ - SMTP2GO    │        │
│  │ - Wallets    │  │   Streams    │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                     (Your Infrastructure + Payment Providers)  │
└─────────────────────────────────────────────────────────────────┘
```

### 🔧 Core Components Breakdown

#### **1. Frontend Layer (User Interface)**
**What it does**: Everything your users see and interact with

**Key Components**:
- **Customer Portal**: Where users manage their VPS instances, view bills, access console
- **Admin Dashboard**: Where you manage users, configure system, view analytics
- **Public Pages**: Login, registration, pricing (can be white-labeled)

**How it works**:
```
User Action → React Component → API Call → Show Response
     ↓              ↓                ↓           ↓
  Click Button  Update State  Backend Process  Update UI
```

#### **2. Backend API Layer (Business Logic)**
**What it does**: Processes requests, enforces rules, talks to external services

**Key Services**:
- **Authentication**: Validates users, issues tokens, controls access
- **VPS Services**: Creates/destroys VPS instances, manages operations
- **Billing Services**: Calculates costs, processes payments, manages wallets
- **Admin Services**: User management, system configuration, reporting

**How it works**:
```
API Request → Middleware → Route Handler → Service Layer → Response
     ↓            ↓            ↓               ↓           ↓
  User Action  Validate    Execute      Business Logic  Return Data
              Auth/Rules   Endpoint     + Database
```

#### **3. Data & Services Layer (Storage & Integration)**
**What it does**: Stores data and connects to external services

**Key Components**:
- **PostgreSQL Database**: All persistent data (users, VPS instances, billing)
- **External APIs**: Linode (VPS infrastructure), PayPal (payments), SMTP (email)
- **WebSocket Bridge**: Real-time SSH terminal access to VPS instances

**How it works**:
```
Service Layer → Database Query → PostgreSQL → Return Results
      ↓                ↓                ↓            ↓
  Need Data    SQL Query +       Execute      Process &
               Parameters        Query        Return
```

### 🔄 How It Works: Complete Flow Examples

#### **1. Customer Registration & First VPS Creation**

```
Step 1: Registration
─────────────────────
User → Sign Up Form → POST /api/auth/register
                                  ↓
                          Create User Record
                                  ↓
                          Generate JWT Token
                                  ↓
                          Send Welcome Email
                                  ↓
                          Return Token + User Data

Step 2: Add Funds to Wallet
────────────────────────────
User → Add Funds → PayPal Payment → POST /api/payments/create
                                            ↓
                                    Create PayPal Order
                                            ↓
                                    User Completes Payment
                                            ↓
                                    PayPal Webhook Confirmation
                                            ↓
                                    Update Wallet Balance
                                            ↓
                                    Send Confirmation Email

Step 3: Create VPS Instance
───────────────────────────
User → Select Plan → POST /api/vps/instances
                                  ↓
                          Validate Wallet Balance
                                  ↓
                          Call Linode API
                                  ↓
                          Create VPS Instance
                                  ↓
                          Save Instance Record
                                  ↓
                          Setup SSH Bridge
                                  ↓
                          Start Hourly Billing
                                  ↓
                          Send Provisioning Email
```

#### **2. Hourly Billing Process**

```
Every Hour:
───────────
Cron Job → Active VPS Instances → Calculate Hourly Cost
              ↓                            ↓
      For Each Instance              Plan Hourly Rate
              ↓                            ↓
      Deduct from Wallet        ×   Hours Since Last Billing
              ↓                            ↓
      Create Transaction Record
              ↓
      Update Instance Last Billing
              ↓
      Check Low Balance → Send Warning if Needed
              ↓
      Generate Invoice (if billing period complete)
```

#### **3. Real-Time SSH Terminal Access**

```
User → Open Console → WebSocket Connection
                            ↓
                    Authenticate User + Instance
                            ↓
                    Establish SSH Connection to VPS
                            ↓
                    Bridge WebSocket ↔ SSH
                            ↓
                    Real-time Terminal in Browser
                            ↓
                    Handle Terminal Resize, Copy/Paste
                            ↓
                    Clean up Connection on Close
```

#### **4. Admin User Management**

```
Admin → User Management → GET /api/admin/users
                              ↓
                      Fetch Users with Pagination
                              ↓
                      Display in Data Table
                              ↓
Admin → Click User → GET /api/admin/users/:id
                              ↓
                      Fetch User Details + Resources
                              ↓
                      Show Impact Analysis (VPS, Billing, Orgs)
                              ↓
Admin → Edit User → PUT /api/admin/users/:id
                              ↓
                      Validate Changes
                              ↓
                      Update User Record
                              ↓
                      Audit Log Entry
                              ↓
                      Send Notification (if applicable)
```

### 🎨 Key Design Patterns

#### **Service Layer Pattern**
```
API Routes → Services → Database
     ↓          ↓          ↓
  Thin    Business Logic  Data Access
Layer     & Rules        & Queries
```
**Benefits**: Reusable logic, easy testing, clear separation

#### **Repository Pattern**
```
Service → Repository → Database
   ↓           ↓           ↓
Business  Data Access  SQL Queries
Logic     Abstraction   & Connection
```
**Benefits**: Database abstraction, easier migration, testable

#### **Observer Pattern (Real-time Updates)**
```
Database Event → PostgreSQL LISTEN/NOTIFY → Server-Sent Events → Client Update
```
**Benefits**: Real-time UI updates, efficient, scalable

#### **Middleware Pattern (Request Processing)**
```
Request → Auth Middleware → Rate Limit → Validation → Route Handler → Response
```
**Benefits**: Reusable request processing, security, validation

### Technology Stack

#### Frontend
- **React 18** - Modern component-based UI framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **TanStack Query** - Powerful server state management
- **Zustand** - Lightweight client state management
- **React Router v7** - Client-side routing with protection
- **shadcn/ui** - Beautiful, accessible component library
- **Tailwind CSS** - Utility-first styling
- **React Hook Form + Zod** - Form handling and validation

#### Backend
- **Node.js 20+** - JavaScript runtime
- **Express.js** - Fast, minimalist web framework
- **TypeScript** - End-to-end type safety
- **PostgreSQL** - Robust relational database
- **JWT** - Secure authentication
- **WebSocket** - Real-time SSH terminal access
- **SSH2** - SSH protocol implementation

#### Integrations
- **Linode/Akamai API** - VPS infrastructure management
- **PayPal REST SDK** - Payment processing
- **SMTP2GO** - Email notifications
- **PostgreSQL LISTEN/NOTIFY** - Real-time database events

---

## ✨ Key Features

### 🖥️ VPS Management
- **Provider Integration**: Direct Linode/Akamai API integration with normalized operations
- **SSH Console Access**: Browser-based terminal with WebSocket bridge for real-time VPS access
- **Automated Provisioning**: One-click VPS deployment with configurable specifications
- **Backup Management**: Flexible backup options (daily/weekly/none) with custom pricing
- **Real-time Monitoring**: Live status updates and resource usage tracking
- **Plan Management**: Customizable VPS plans with provider-specific configurations

### 💰 Billing & Payments
- **Wallet System**: Prepaid wallet with automatic balance deduction
- **Hourly Billing**: Automated hourly billing with detailed usage tracking
- **PayPal Integration**: Seamless payment processing with PayPal REST API
- **Invoice Generation**: Automatic invoice creation with PDF downloads
- **Payment History**: Complete transaction history with detailed breakdowns
- **Usage Analytics**: Resource usage monitoring and cost analysis

### 👥 User & Organization Management
- **Multi-tenant Architecture**: Organization-based data separation and access control
- **Role-based Permissions**: Admin, owner, and member roles with granular permissions
- **Advanced User Management**: Comprehensive admin interface with enhanced error handling
- **Organization Workflows**: Complete CRUD operations with validation and safety checks
- **Member Management**: Add, edit, and remove organization members with role controls
- **Impersonation**: Admin capability to impersonate users for support

### 🔐 Security & Authentication
- **JWT Authentication**: Secure token-based authentication with configurable expiration
- **Rate Limiting**: Tiered API rate limits (anonymous/authenticated/admin)
- **Password Security**: Bcrypt hashing with secure reset workflows
- **Access Control**: Role-based access control throughout the application
- **Audit Logging**: Comprehensive activity tracking for security and compliance

### 🎨 White-Label & Branding
- **Complete Customization**: Environment-driven branding configuration
- **Theme System**: Multiple theme presets with custom color schemes
- **Provider Abstraction**: Hide upstream provider names from end users
- **Custom Domain Support**: Full white-label experience for your brand

### ⚡ Real-Time Features
- **Live Notifications**: PostgreSQL LISTEN/NOTIFY with Server-Sent Events
- **SSH Terminal**: Real-time terminal access with WebSocket bridge
- **Activity Feeds**: Live activity streams for all system events
- **Status Updates**: Real-time VPS status and resource monitoring

### 🛠️ Admin Features
- **Dashboard**: System overview with key metrics and quick actions
- **User Management**: Enhanced user CRUD with resource impact analysis
- **Organization Management**: Advanced modal-based UI with comprehensive validation
- **Provider Configuration**: Multi-provider setup with API token management
- **Platform Settings**: System configuration, themes, and branding options
- **Support System**: Ticket management and customer support tools
- **FAQ Management**: Help documentation and knowledge base

### 📱 Modern UI/UX
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Accessibility**: ARIA-compliant components with keyboard navigation
- **Dark/Light Themes**: Multiple theme presets with system preference detection
- **Modal-based Interactions**: Enhanced dialogs with proper validation feedback
- **Drag & Drop**: Intuitive interfaces for configuration management
- **Loading States**: Proper loading indicators and error handling

### 👨‍💻 Developer Experience
- **TypeScript**: End-to-end type safety across frontend and backend
- **Hot Reload**: Fast development with Vite HMR and Nodemon
- **API Documentation**: Comprehensive API reference with examples
- **Testing Suite**: Vitest, React Testing Library, and Supertest
- **Code Quality**: ESLint, TypeScript strict mode, and automated formatting
- **Database Migrations**: Versioned schema management with rollback support

## 🎯 Use Cases & Scenarios

### Who Should Use SkyPanelV2?

#### **1. IT Service Providers**
- **Scenario**: You manage IT infrastructure for small businesses
- **Use Case**: Offer branded VPS hosting services to your clients
- **Benefit**: Additional revenue stream, better client retention

#### **2. Web Agencies & Developers**
- **Scenario**: You build websites and need hosting for clients
- **Use Case**: Provide managed hosting as part of your service packages
- **Benefit**: Complete control over client environments, recurring revenue

#### **3. MSPs (Managed Service Providers)**
- **Scenario**: You provide comprehensive IT services
- **Use Case**: Bundle VPS hosting with your existing services
- **Benefit**: One platform for all client services, simplified billing

#### **4. Hosting Resellers**
- **Scenario**: You want to start a hosting business
- **Use Case**: Launch your own branded hosting service
- **Benefit**: No infrastructure costs, focus on sales and support

#### **5. Startups & SaaS Companies**
- **Scenario**: You need hosting for your application clients
- **Use Case**: Offer hosting as part of your platform
- **Benefit**: Additional revenue, better customer experience

### Real-World Scenarios

#### **Scenario 1: Freelancer Hosting Clients**
```
Before SkyPanelV2:
- Client asks for hosting → You buy VPS from Linode → Client pays you manually
- No proper billing, no dashboard, manual everything

After SkyPanelV2:
- Client signs up on your branded portal
- Client selects plan and pays via PayPal
- VPS automatically provisioned
- Hourly billing deducts from wallet
- Client manages their own VPS
- You focus on support, not administration
```

#### **Scenario 2: Agency Client Onboarding**
```
New Website Project:
1. Create client organization in admin panel
2. Add client team members with appropriate roles
3. Create VPS instance for staging environment
4. Client tests staging site
5. Create production VPS instance
6. Client funds wallet for monthly billing
7. Automated billing handles everything
8. Client has self-service portal
```

#### **Scenario 3: Scaling Your Hosting Business**
```
Growth Phases:

Phase 1 (Startup):
- 10-20 clients
- Manual onboarding
- Basic VPS plans
- PayPal payments only

Phase 2 (Growth):
- 50-100 clients
- Automated onboarding
- Multiple plan tiers
- Advanced billing features
- Client self-service

Phase 3 (Scale):
- 100+ clients
- Multiple payment gateways
- Advanced features
- White-label mobile app
- API integrations
```

## 📊 Data Flow & State Management

### Frontend State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Client State (Zustand)                   │
│  - User authentication status                              │
│  - Theme preferences                                       │
│  - UI states (modals, sidebars)                            │
│  - Temporary form data                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                 Server State (TanStack Query)              │
│  - VPS instances and status                                │
│  - Wallet balance and transactions                         │
│  - User profiles and organizations                         │
│  - System configuration and settings                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                            │
│  - Express.js routes                                       │
│  - Service layer business logic                            │
│  - Database queries                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│  - Persistent data storage                                 │
│  - ACID transactions                                       │
│  - Real-time events (LISTEN/NOTIFY)                       │
└─────────────────────────────────────────────────────────────┘
```

### Real-Time Data Sync

```
Database Change → PostgreSQL NOTIFY → Server-Sent Events → Client Update
     ↓                  ↓                    ↓                 ↓
User Creates VPS   Trigger fires      SSE sends event    UI updates
Record            Notification        to connected       automatically
                  to channel          clients
```

## 🔐 Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────┐
│                   Authentication Flow                       │
│                                                             │
│  1. User Login → POST /api/auth/login                      │
│  2. Validate credentials → Users table                     │
│  3. Generate JWT token → Contains user ID, role, org ID    │
│  4. Return token to client                                 │
│  5. Client stores token → localStorage/cookie              │
│  6. All subsequent requests → Include JWT in headers       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Authorization Flow                        │
│                                                             │
│  Protected Request → JWT Middleware → Extract User Context │
│                           ↓                                │
│                    Role-Based Access Control               │
│                           ↓                                │
│  ┌─────────────────────────────────────────────────┐      │
│  │ Role Permissions:                              │      │
│  │ - Admin: Full system access                    │      │
│  │ - Owner: Organization management               │      │
│  │ - Member: Limited access within organization   │      │
│  └─────────────────────────────────────────────────┘      │
│                           ↓                                │
│              Allow/Deny Request → 403 if unauthorized      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Rate Limiting Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   Tiered Rate Limiting                      │
│                                                             │
│  Anonymous Users:    200 requests / 15 minutes              │
│  Authenticated:      500 requests / 15 minutes              │
│  Admin Users:       1000 requests / 15 minutes              │
│                                                             │
│  Implementation:                                             │
│  - Redis-backed counters (in production)                    │
│  - IP-based identification for anonymous                   │
│  - User-based for authenticated                             │
│  - Sliding window algorithm                                 │
│  - Custom limits per endpoint type                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Protection

```
┌─────────────────────────────────────────────────────────────┐
│                   Encryption Layers                         │
│                                                             │
│  1. Data at Rest:                                           │
│     - SSH credentials: AES-256 encryption                   │
│     - API tokens: AES-256 encryption                        │
│     - Environment variables: Encrypted storage              │
│                                                             │
│  2. Data in Transit:                                        │
│     - HTTPS/TLS for all communications                      │
│     - WebSocket over secure connection (WSS)                │
│     - Database connection over SSL                          │
│                                                             │
│  3. Authentication:                                         │
│     - Passwords: Bcrypt hashing                             │
│     - JWT tokens: Signed with secret key                    │
│     - Session management: Secure cookies                   │
│                                                             │
│  4. Audit Trail:                                            │
│     - All admin actions logged                              │
│     - User activity tracking                                │
│     - Failed authentication attempts                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
skypanelv2/
├── api/                          # Backend API (Express.js)
│   ├── routes/                   # API route definitions
│   │   ├── admin/               # Admin-only endpoints
│   │   ├── auth.ts              # Authentication routes
│   │   ├── vps.ts               # VPS management
│   │   ├── payments.ts          # Payment processing
│   │   └── ...
│   ├── services/                # Business logic layer
│   │   ├── vpsService.ts        # VPS operations
│   │   ├── billingService.ts    # Billing logic
│   │   ├── emailService.ts      # Email notifications
│   │   └── ...
│   ├── middleware/              # Express middleware
│   │   ├── auth.ts              # JWT authentication
│   │   ├── rateLimiting.ts      # API rate limiting
│   │   └── security.ts          # Security headers
│   ├── lib/                     # Utility libraries
│   │   ├── database.ts          # Database helper
│   │   ├── crypto.ts            # Encryption utilities
│   │   └── validation.ts        # Input validation
│   └── server.ts                # Server entry point
├── src/                          # Frontend (React)
│   ├── components/              # React components
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── admin/              # Admin-specific components
│   │   ├── layouts/            # Layout components
│   │   └── ...
│   ├── pages/                   # Page components
│   ├── contexts/                # React contexts (Auth, Theme)
│   ├── services/                # API client services
│   ├── lib/                     # Frontend utilities
│   │   ├── api.ts              # API client
│   │   ├── validation.ts       # Form validation schemas
│   │   └── ...
│   └── main.tsx                 # React entry point
├── migrations/                   # Database migrations
│   ├── 001_initial_schema.sql
│   ├── 002_*.sql
│   └── ...
├── scripts/                     # Utility scripts
│   ├── generate-ssh-secret.js   # Generate encryption keys
│   ├── run-migration.js         # Apply migrations
│   ├── create-test-admin.js     # Create admin users
│   └── test-smtp.js             # Test email configuration
├── public/                      # Static assets
└── package.json                 # Dependencies and scripts
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm 9+** - Comes with Node.js
- **PostgreSQL 12+** - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)

### Required Accounts & API Keys

You'll need accounts with:
- **Linode/Akamai** - For VPS infrastructure (get API token from account settings)
- **PayPal** - For payment processing (create REST API credentials in developer dashboard)
- **SMTP2GO** (optional) - For email notifications

### Quick Start (5 Minutes)

#### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/skyvps360/skypanelv2.git
cd skypanelv2

# Install dependencies
npm install
```

#### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Generate encryption secret
node scripts/generate-ssh-secret.js
```

Edit `.env` and configure these essential variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
SSH_CRED_SECRET=generated-by-script-above
ENCRYPTION_KEY=your-32-character-encryption-key

# PayPal (get from PayPal Developer Dashboard)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Linode (get from Linode Account Settings)
LINODE_API_TOKEN=your-linode-api-token

# Branding (optional)
VITE_COMPANY_NAME=Your Company Name
COMPANY_NAME=Your Company Name
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
- ⚠️ **Change these immediately in production!**

#### 4. Start Development Servers

```bash
# Start both frontend and backend
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173 (Vite dev server with hot reload)
- **Backend**: http://localhost:3001 (Express API with auto-restart)

#### 5. Access Your Panel

1. Open http://localhost:5173 in your browser
2. Login with admin credentials
3. Configure your Linode provider in Admin → Providers
4. Create VPS plans in Admin → VPS Plans
5. Start creating VPS instances!

### Detailed Setup Guide

#### Database Configuration

**PostgreSQL Setup:**

```bash
# Create database
createdb skypanelv2

# Test connection
node scripts/test-connection.js
```

**Apply Migrations:**

```bash
# Apply all pending migrations
node scripts/run-migration.js

# Or use npm script
npm run db:fresh
```

#### PayPal Configuration

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create a new REST API app
3. Copy Client ID and Secret to `.env`
4. Set `PAYPAL_MODE=sandbox` for testing, `live` for production
5. Configure webhook URL: `https://your-domain.com/api/payments/webhook`

#### Linode Configuration

1. Go to [Linode Account Settings](https://cloud.linode.com/profile/tokens)
2. Create a personal access token with these permissions:
   - Read/Write access to Linodes
   - Read access to Account, Networking, and Support
3. Add token to `.env` as `LINODE_API_TOKEN`

#### Email Configuration (Optional)

```bash
# SMTP2GO Configuration
SMTP2GO_API_KEY=your-api-key
SMTP2GO_USERNAME=your-username
SMTP2GO_PASSWORD=your-password

# Test email configuration
node scripts/test-smtp.js
```

---

## 🛠️ Development Guide

### Development Workflow

#### Starting Development Environment

```bash
# Start both frontend and backend (recommended)
npm run dev

# Or start individually
npm run client:dev    # Frontend only on port 5173
npm run server:dev    # Backend only on port 3001
```

**What happens when you run `npm run dev`:**
- Vite dev server starts with hot module replacement
- Express API server starts with auto-restart on file changes
- Both servers watch for changes and reload automatically

#### Database Operations

```bash
# Reset database completely (with confirmation)
npm run db:reset

# Reset without confirmation prompt
npm run db:reset:confirm

# Fresh start: reset + apply all migrations
npm run db:fresh

# Create admin user
npm run seed:admin
```

#### Testing

```bash
# Run all tests once
npm run test

# Run tests in watch mode (during development)
npm run test:watch

# Type checking only
npm run check

# Lint code
npm run lint
```

#### Building

```bash
# Production build with TypeScript check
npm run build

# Preview production build locally
npm run preview
```

### Development Tips

**Frontend Development:**
- Use React DevTools for component debugging
- Check Network tab for API calls and responses
- TanStack Query DevTools for server state inspection
- Browser console for client-side errors

**Backend Development:**
- Use `console.log` for debugging (removed in production)
- Check API responses in Postman or curl
- Monitor database queries during development
- Test API endpoints with proper authentication

**Database Development:**
- Always use parameterized queries (no SQL injection)
- Test migrations in development before production
- Use transactions for multi-step operations
- Backup database before major changes

### Common Development Tasks

**Adding a New API Endpoint:**

1. Create route in `api/routes/`
2. Add business logic in `api/services/`
3. Add authentication middleware if needed
4. Update API documentation

**Adding a New Frontend Page:**

1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link if needed
4. Test authentication/authorization

**Database Schema Changes:**

1. Create new migration file in `migrations/`
2. Write SQL for schema changes
3. Test migration in development
4. Update TypeScript types if needed

**Adding Environment Variables:**

1. Add to `.env.example` with documentation
2. Add to `.env` with your values
3. Reference in code via `process.env.VAR_NAME`
4. Document in `repo-docs/ENVIRONMENT_VARIABLES.md`

### Useful Scripts

**Database Scripts:**
```bash
node scripts/test-connection.js          # Test database connection
node scripts/run-migration.js            # Apply pending migrations
node scripts/generate-ssh-secret.js      # Generate encryption keys
```

**Admin Scripts:**
```bash
node scripts/create-test-admin.js        # Create admin user
node scripts/promote-to-admin.js         # Promote user to admin
node scripts/update-admin-password.js    # Change admin password
```

**Testing Scripts:**
```bash
node scripts/test-hourly-billing.js      # Test billing workflow
node scripts/test-smtp.js                # Test email configuration
```

### File Structure Best Practices

**Where to put things:**
- **UI Components**: `src/components/`
- **Page Components**: `src/pages/`
- **API Routes**: `api/routes/`
- **Business Logic**: `api/services/`
- **Shared Types**: Create shared types file
- **Utility Functions**: `src/lib/` or `api/lib/`
- **Database Queries**: `api/services/` or `api/lib/`

**Naming Conventions:**
- Components: PascalCase (`UserProfile.tsx`)
- Utilities: camelCase (`formatCurrency.ts`)
- Services: camelCase with Service suffix (`vpsService.ts`)
- API Routes: kebab-case (`/vps-instances`)

---

## 🚀 Deployment

### Production Checklist

Before deploying to production, ensure you've completed these steps:

#### Security Setup
- [ ] **Strong JWT Secret** - Use a 32+ character random string
- [ ] **Secure Database Password** - Don't use default passwords
- [ ] **HTTPS/SSL** - Configure valid TLS certificate
- [ ] **PayPal Live Credentials** - Switch from sandbox to production
- [ ] **Environment Variables** - Set `NODE_ENV=production`
- [ ] **Rate Limiting** - Configure appropriate limits for your traffic
- [ ] **Database Backups** - Set up automated backups

#### Configuration
- [ ] **Provider API Tokens** - Use production tokens with proper permissions
- [ ] **Email Service** - Configure production SMTP credentials
- [ ] **Domain Configuration** - Set `CLIENT_URL` to your production domain
- [ ] **CORS Settings** - Configure allowed origins
- [ ] **Trust Proxy** - Set `TRUST_PROXY=1` behind reverse proxy

#### Testing
- [ ] **Test Payment Flow** - Verify PayPal integration works
- [ ] **Test VPS Creation** - Ensure provider integration works
- [ ] **Test Email Delivery** - Verify notifications are sent
- [ ] **Test Admin Panel** - Check all admin functionality
- [ ] **Load Testing** - Test with expected user load

### Deployment Options

#### Option 1: PM2 on VPS (Recommended)

**Prerequisites:**
- VPS with Ubuntu 20.04+ or similar
- Node.js 20+ and PostgreSQL 12+
- Domain name with DNS configured

**Steps:**

1. **Clone and Setup:**
```bash
# Clone repository
git clone https://github.com/skyvps360/skypanelv2.git
cd skypanelv2

# Install dependencies
npm install

# Build production assets
npm run build
```

2. **Configure Environment:**
```bash
# Copy and edit environment file
cp .env.example .env
nano .env

# Set production values
NODE_ENV=production
CLIENT_URL=https://your-domain.com
```

3. **Setup Database:**
```bash
# Apply migrations
npm run db:fresh

# Create admin user
npm run seed:admin
```

4. **Start with PM2:**
```bash
# Install PM2 globally
npm install -g pm2

# Start application
npm run pm2:start

# Monitor processes
pm2 monit
pm2 logs skypanelv2
```

5. **Configure SSL with Caddy:**
```bash
# Setup Caddy reverse proxy
sudo bash scripts/setup-caddy-ssl.sh \
  --domain panel.yourdomain.com \
  --email admin@yourdomain.com \
  --install-caddy
```

#### Option 2: Docker Deployment

```dockerfile
# Dockerfile example
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build application
COPY . .
RUN npm run build

# Expose ports
EXPOSE 3001 5173

# Start application
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t skypanelv2 .
docker run -p 3001:3001 -p 5173:5173 --env-file .env skypanelv2
```

#### Option 3: Cloud Platforms

**Vercel (Frontend) + Separate Backend:**
```bash
# Deploy frontend to Vercel
vercel --prod

# Deploy backend to your preferred VPS provider
```

**DigitalOcean App Platform:**
1. Connect your GitHub repository
2. Configure build settings
3. Set environment variables
4. Deploy

### Monitoring & Maintenance

**Health Checks:**
```bash
# Check application health
curl https://your-domain.com/api/health

# Check PM2 status
pm2 list
pm2 logs
```

**Database Backups:**
```bash
# Manual backup
pg_dump skypanelv2 > backup_$(date +%Y%m%d).sql

# Automated backup (add to crontab)
0 2 * * * pg_dump skypanelv2 > /backups/db_$(date +\%Y\%m\%d).sql
```

**Log Management:**
```bash
# View logs
pm2 logs skypanelv2

# Clear logs
pm2 flush

# Log rotation (configure in PM2 ecosystem)
```

**Updates:**
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart PM2
npm run pm2:reload
```

### Troubleshooting Production Issues

**Application Won't Start:**
- Check environment variables are set correctly
- Verify database connection is accessible
- Check ports are not already in use
- Review PM2 logs: `pm2 logs`

**Database Connection Issues:**
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists and migrations are applied
- Test connection: `node scripts/test-connection.js`

**Payment Processing Issues:**
- Verify PayPal credentials are correct for production
- Check webhook URLs are accessible
- Ensure IPN/ webhook notifications are reaching your server
- Test PayPal connection in provider settings

**VPS Provisioning Issues:**
- Verify Linode API token has correct permissions
- Check provider configuration in admin panel
- Test API connection in provider settings
- Review Linode account limits and quotas

**Performance Issues:**
- Check database query performance
- Verify rate limiting is configured properly
- Monitor resource usage with PM2
- Consider upgrading server resources

---

## 📚 Documentation

### API Documentation

**Core API References:**
- **[API Reference](./api-docs/README.md)** - Complete API endpoint documentation
- **[Admin API](./api-docs/admin/README.md)** - Administrative operations and endpoints
- **[Authentication](./api-docs/auth.md)** - Authentication and authorization flow

**Feature Documentation:**
- **[Organization Management](./api-docs/admin/organizations.md)** - Organization CRUD operations
- **[Member Management](./api-docs/admin/organization-members.md)** - Organization member operations
- **[User Management](./api-docs/admin/user-detail.md)** - User account management
- **[User Search](./api-docs/admin/user-search.md)** - User search and filtering
- **[VPS Management](./repo-docs/MULTI_PROVIDER_VPS.md)** - Multi-provider VPS operations
- **[Backup Pricing](./repo-docs/FLEXIBLE_BACKUP_PRICING_API.md)** - Backup configuration API

### Configuration Guides

- **[Environment Variables](./repo-docs/ENVIRONMENT_VARIABLES.md)** - Complete configuration reference
- **[SSL Setup](./repo-docs/SSL_SETUP.md)** - HTTPS configuration with Caddy
- **[Development Setup](./CLAUDE.md)** - Development environment and coding guidelines

### Architecture Documentation

- **[Database Schema](./repo-docs/DATABASE_SCHEMA.md)** - Database structure and relationships
- **[Service Architecture](./repo-docs/SERVICES.md)** - Backend service layer patterns
- **[Frontend Patterns](./repo-docs/FRONTEND.md)** - Frontend architecture and patterns

### Additional Resources

- **[Agent Instructions](./AGENTS.md)** - Guidelines for AI agents working on this codebase
- **[GitHub Copilot Instructions](./.github/copilot-instructions.md)** - Copilot configuration

---

## 🧪 Testing & Quality Assurance

### Test Overview

SkyPanelV2 includes comprehensive testing at multiple levels:

**Unit Tests:**
- Component logic and utilities
- Validation schemas and rules
- Service layer business logic
- API endpoint testing

**Integration Tests:**
- Database operations and migrations
- API authentication and authorization
- Payment processing workflows
- VPS provisioning operations

**Component Tests:**
- UI component behavior and interactions
- Form validation and error handling
- User workflows and navigation
- Accessibility testing

### Running Tests

```bash
# Run all tests once
npm run test

# Run tests in watch mode (development)
npm run test:watch

# Run specific test file
npm test -- vps.test.ts

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

```
tests/
├── unit/              # Unit tests
│   ├── components/   # Component logic tests
│   ├── services/     # Service layer tests
│   └── utils/        # Utility function tests
├── integration/       # Integration tests
│   ├── api/          # API endpoint tests
│   └── database/     # Database operation tests
└── e2e/              # End-to-end tests
    └── scenarios/    # User workflow tests
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

## 🤝 Contributing

### How to Contribute

We welcome contributions from the community! Here's how you can help:

1. **Fork the Repository**
   ```bash
   # Fork on GitHub and clone your fork
   git clone https://github.com/your-username/skypanelv2.git
   cd skypanelv2
   ```

2. **Set Up Development Environment**
   ```bash
   # Install dependencies
   npm install

   # Setup environment
   cp .env.example .env
   # Configure your .env file

   # Setup database
   npm run db:fresh
   npm run seed:admin
   ```

3. **Create Your Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Your Changes**
   - Write clean, documented code
   - Follow existing code patterns
   - Add tests for new functionality
   - Update documentation as needed

5. **Test Your Changes**
   ```bash
   # Run tests
   npm run test

   # Type checking
   npm run check

   # Linting
   npm run lint
   ```

6. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

7. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

### Contribution Guidelines

**Code Style:**
- Follow TypeScript best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Maintain consistent formatting

**Testing:**
- Write tests for new features
- Ensure all tests pass before submitting
- Test across different browsers and devices
- Verify accessibility compliance

**Documentation:**
- Update README for user-facing changes
- Add API documentation for new endpoints
- Document complex business logic
- Update configuration guides

**Pull Request Best Practices:**
- Provide clear description of changes
- Link related issues
- Include screenshots for UI changes
- Ensure CI/CD checks pass

### Areas Where We Need Help

**High Priority:**
- Additional cloud provider integrations (DigitalOcean, AWS, etc.)
- Enhanced monitoring and analytics
- Performance optimization
- Security enhancements
- Documentation improvements

**Medium Priority:**
- Additional payment gateways (Stripe, etc.)
- Enhanced reporting and dashboards
- Mobile app development
- API integrations and webhooks
- Automation features

**Low Priority:**
- UI/UX improvements
- Accessibility enhancements
- Translation and internationalization
- Community plugins and extensions

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💖 Support

### Getting Help

**Documentation:**
- Check the [API Documentation](./api-docs/)
- Review [Configuration Guides](./repo-docs/)
- Search existing [GitHub Issues](https://github.com/skyvps360/skypanelv2/issues)

**Community:**
- Open an issue on GitHub
- Join our discussions
- Check existing issues and PRs

**Professional Support:**
- Contact us for enterprise support
- Custom development services
- Integration assistance

---

## 🌟 Acknowledgments

Built by [skyvps360](https://github.com/skyvps360) for the open-source community.

**Special Thanks To:**
- All contributors who have helped make SkyPanelV2 better
- The open-source community for amazing tools and libraries
- Early adopters who provide valuable feedback
- Cloud providers who make VPS hosting accessible

**Built With:**
- React and the amazing React community
- The Vite team for the incredible build tool
- shadcn for the beautiful component library
- TanStack for the powerful state management
- All other open-source maintainers and contributors

---

## 📞 Contact

- **Website**: [Your website]
- **Email**: [Your email]
- **GitHub**: [skyvps360/skypanelv2](https://github.com/skyvps360/skypanelv2)
- **Issues**: [GitHub Issues](https://github.com/skyvps360/skypanelv2/issues)

---

**⭐ Star us on GitHub** if you find this project helpful!

**Made with ❤️ by the SkyPanelV2 team**

---

## 💖 Donate

If you find this project useful, consider supporting its development:

[![PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate/?hosted_button_id=TEY7YEJC8X5HW)

**Your support helps us:**
- Maintain and improve the project
- Add new features and integrations
- Provide better documentation
- Support the community

Thank you for your support! 🙏
