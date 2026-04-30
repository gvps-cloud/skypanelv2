# Linode Feature Roadmap

Feature parity roadmap for SkyPanelV2's Linode VPS hosting integration.

---

## Implemented Features

### Core VPS Management ✓

- **Instance lifecycle**
  - Create Linode instances (with Marketplace app support via StackScript)
  - Boot, shutdown, reboot
  - Rebuild (wipes disks, redeploys specified image)
  - Delete
  - Update label/hostname via `updateLinodeInstance()`
  - Toggle watchdog (悠卡/watchdog_enabled)
  - Instance stats (CPU, network, IO for last 24h via `getLinodeInstanceStats()`)
  - Instance transfer usage (`getLinodeInstanceTransfer()`)

- **VPS plans and pricing**
  - Fetch available plan types from Linode API (`getLinodeTypes()`)
  - Plan metadata stored in database (pricing, specs, transfer quotas)
  - All Linode type classes surfaced: nanode, standard, dedicated, highmem, premium, gpu, accelerated
  - Regional plan availability via `vps_plan_regions`

- **Images**
  - Public images list (`getLinodeImages()`)
  - Vendor filtering, deprecation/expiry handling
  - StackScript support (`getLinodeStackScripts()`, `getStackScript()`)
  - Create/update StackScripts for automation

- **SSH keys**
  - Fetch, create, delete SSH keys via Linode API (`getSSHKeys()`, `createSSHKey()`, `deleteSSHKey()`)
  - Organization-level SSH key management stored in database

- **StackScripts**
  - CRUD operations via Linode API
  - Marketplace app discovery (official endpoint + StackScript fallback)
  - User-defined fields with secret field autofill (Linode API token)

---

### Networking ✓

- **IP addressing**
  - IPv4/IPv6 addresses from `getLinodeInstanceIPs()`
  - Allocate additional IPv4 addresses (`allocateIP()`)
  - Delete IP addresses (`deleteIPAddress()`)
  - IP assignment and sharing (`assignIPs()`, `shareIPs()`)

- **rDNS**
  - Update reverse DNS for IPv4 and IPv6 (`updateIPAddressReverseDNS()`)
  - Custom rDNS setup on instance creation (async background job)
  - IPv6 rDNS records via `getAccountNetworkingIPs()`
  - Configured via `RDNS_BASE_DOMAIN` environment variable

- **IPv6**
  - IPv6 pools (`listIPv6Pools()`)
  - IPv6 ranges (`listIPv6Ranges()`, `getIPv6Range()`)
  - Create/delete IPv6 ranges (`createIPv6Range()`, `deleteIPv6Range()`)
  - IPv6 range details with BGP flag and linked Linodes

- **Firewalls**
  - Full firewall lifecycle: create, get, update, delete
  - List all firewalls (`listFirewalls()`)
  - Firewall rules: get/update rules with inbound/outbound policies
  - Attach/detach firewalls to/from instances (`attachFirewallToLinode()`, `detachFirewallFromLinode()`)
  - Firewall devices management (`getFirewallDevices()`)
  - Firewall history (`getFirewallHistory()`)
  - Firewall settings (`getFirewallSettings()`, `updateFirewallSettings()`)
  - Firewall templates (`listFirewallTemplates()`, `getFirewallTemplate()`)

- **VLANs**
  - List VLANs (`listVLANs()`)
  - Delete VLAN (`deleteVLAN()`)

---

### Billing & Egress ✓

- **Hourly VPS billing**
  - Hourly billing cycles tracked per organization
  - Wallet-based prepaid billing (wallet debit model)
  - Billing cycle execution via `egressBillingService.ts`

- **Egress (transfer) credit system**
  - Prepaid egress credit packs (100GB–10TB) via PayPal
  - Hourly transfer polling from Linode transfer API
  - Regional egress pricing (core, special, distributed regions)
  - Global and regional transfer pool allocation
  - Auto-suspend VPS when organization credit balance hits zero
  - Live billing projection and execution
  - Organization egress overview (live and historical)
  - Deletion snapshots for accurate final billing
  - Per-VPS breakdown of egress charges

- **Wallet operations**
  - Wallet balance tracking
  - Wallet top-up via PayPal
  - Payment transaction history

---

### Disks & Backups ✓

- **Disk management**
  - List disks (`listDisks()`)
  - Get individual disk (`getDisk()`)
  - Create disk with filesystem, image, root password, SSH keys (`createDisk()`)
  - Update disk label/filesystem (`updateDisk()`)
  - Resize disk (`resizeDisk()`)
  - Clone disk (`cloneDisk()`)
  - Reset disk password (`resetDiskPassword()`)
  - Delete disk (`deleteDisk()`)

- **Backup management**
  - Enable/disable backups (`enableLinodeBackups()`, `cancelLinodeBackups()`)
  - Backup schedule (day/window) (`updateLinodeBackupSchedule()`)
  - Create backup snapshot (`createLinodeBackup()`)
  - Restore backup to same or target instance (`restoreLinodeBackup()`)
  - Get backup info including snapshot status (`getLinodeInstanceBackups()`)

---

### Organization Management ✓

- Multi-tenant organizations with row-level security
- Role-based access control (RBAC)
- Custom roles with granular permissions (vps_manage, vps_delete, billing_view, etc.)
- Organization memberships and invitations
- Impersonation support for admin support access

---

## Feature Backlog

Features planned but not yet implemented:

### Placement Groups
- Instance grouping/colocation controls
- Affinity and anti-affinity policies
- Currently no Linode Placement Groups API integration

### VPC / Private VLAN Interfaces
- VPC/private VLAN interface management beyond basic VLANs
- Network-level isolation and private networking
- `LinodeProviderService` has `createNetworkInterface()` stub and `IProviderService` defines `linode_interface` type, but VPC creation/management UI is not built

### Instance Metadata Service
- Cloud-init user data injection
- Instance metadata API access
- No metadata service integration currently

### Dedicated / GPU Plan Type Badges
- Plan type badges (dedicated, gpu, premium, accelerated, highmem) already exposed via `type_class` from Linode API
- Display in UI is partially implemented; dedicated/gpu badge UI components may need refinement

### Volume Management (Block Storage)
- Additional block storage volumes
- Attach/detach volumes to instances
- Volume snapshots
- No Volume API integration currently

---

## Out of Scope

Features explicitly not supported by this panel:

- **LKE (Linode Kubernetes Engine)** — no Kubernetes cluster management
- **NodeBalancers** — no load balancer integration
- **Object Storage (S3-compatible)** — no S3-compatible storage
- **Linode Databases** — no managed database support
- **Longview** — no Longview monitoring integration
- **DNS / Domain Manager** — no zone or domain record management
- **Block Storage Volumes** — no standalone volume lifecycle management (beyond current VLAN support)
- **Bare Metal** — no bare metal instance type support
- **Macrom** — no macOS-based instances
