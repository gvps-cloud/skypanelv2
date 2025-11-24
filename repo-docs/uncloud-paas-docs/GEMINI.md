# Uncloud PaaS Documentation Context for Gemini

## Overview
This directory contains the documentation for **Uncloud**, the Platform-as-a-Service (PaaS) engine powering SkyPanelV2's application hosting capabilities. Uncloud is a decentralized, CLI-driven container orchestrator that simplifies multi-machine deployments using standard Docker Compose files.

## Key Components

### 1. Uncloud CLI (`uc`)
*   **Purpose:** The primary interface for managing clusters, machines, and deployments.
*   **Functionality:** Handles machine provisioning, service deployment (rolling updates), scaling, logs, and exec.
*   **Networking:** Automatically creates a WireGuard mesh between all machines in a cluster.
*   **Philosophy:** "Docker Swarm/Kubernetes alternative" but simpler, masterless, and decentralized.

### 2. Unregistry (`docker pussh`)
*   **Purpose:** A lightweight mechanism to push Docker images directly to remote servers via SSH, bypassing external registries like Docker Hub.
*   **Mechanism:** Transfers only missing layers directly to the remote machine's `containerd` store.
*   **Documentation:** `unregistry-readme.md`

## Documentation Structure

*   **`1-overview.md`**: High-level introduction to Uncloud's architecture (decentralized, WireGuard overlay, no control plane).
*   **`2-getting-started/`**: Guides for installing the CLI and deploying a "Hello World" application.
*   **`3-concepts/`**: Deep dives into core mechanics:
    *   **Ingress/Caddy:** Automatic HTTPS and reverse proxying (`3-concepts/1-ingress/`).
    *   **Services:** Internal DNS, container environments (`3-concepts/6-services/`).
*   **`8-compose-file-reference/`**: Detailed compatibility matrix for Docker Compose features.
    *   **Key Extensions:**
        *   `x-ports`: managing HTTP/HTTPS/TCP ingress.
        *   `x-machines`: pinning services to specific nodes.
        *   `x-caddy`: advanced custom proxy config.
*   **`9-cli-reference/`**: Auto-generated reference for all `uc` commands (e.g., `uc run`, `uc deploy`, `uc machine`).

## Usage Context
When working in this directory, you are likely:
1.  **Updating Documentation:** Modifying guides or reference materials for Uncloud users.
2.  **Learning Internals:** Understanding how SkyPanelV2 interfaces with the underlying PaaS layer.
3.  **Troubleshooting:** checking supported Compose features or CLI flags.

## Key Concepts for SkyPanel Integration
*   **No Central Master:** All nodes are equal; SkyPanel likely talks to *any* node or a specific "gateway" node via SSH/API to issue `uc` commands.
*   **Compose-First:** Deployments are defined via `docker-compose.yml` files.
*   **Zero-Downtime:** Uncloud handles rolling updates natively.
