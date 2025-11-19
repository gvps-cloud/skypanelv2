# Product Overview

SkyPanelV2 is an open-source cloud service billing panel that provides a white-label control plane for cloud hosting businesses. It enables service providers to offer VPS hosting services through a unified interface with integrated billing, customer management, and comprehensive administrative tools.

## Core Purpose

- **Multi-provider VPS management**: Unified interface for managing VPS instances across cloud providers (currently Linode/Akamai)
- **Billing & payments**: Prepaid wallet system with PayPal integration and automated hourly billing
- **White-label branding**: Complete customization via environment variables for resellers
- **Admin & user management**: Role-based access with organization support and impersonation capabilities

## Key Features

- Real-time SSH console access via WebSocket
- Automated hourly VPS billing with wallet deductions
- Invoice generation and payment history tracking
- Support ticket system with real-time messaging
- Activity logging and audit trails
- Rate limiting with tiered access (anonymous, authenticated, admin)
- PostgreSQL LISTEN/NOTIFY for real-time notifications via SSE
- Provider abstraction layer to hide upstream provider details from end users

## User Roles

- **Admin**: Full system access, user management, provider configuration, impersonation
- **User**: VPS management, billing, support tickets, SSH keys
- **Anonymous**: Public pages (pricing, FAQ, contact, status)
