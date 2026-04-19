# Linode Coverage Matrix

Maps frontend VPSDetail actions to API routes to linodeService methods to Linode OpenAPI paths.

## Legend

- **Status**: ✓ Implemented | ⚠ Needs Review | ✗ Missing | N/A Not Applicable

---

## 1. Instance Management

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get VPS Detail | `GET /api/vps/:id` | `getLinodeInstance()` | `GET /v4/linode/instances/{linodeId}` | ✓ Implemented |
| List VPS Instances | `GET /api/vps` | `getLinodeInstances()` | `GET /v4/linode/instances` | ✓ Implemented |
| Boot VPS | `POST /api/vps/:id/boot` | `bootLinodeInstance()` | `POST /v4/linode/instances/{linodeId}/boot` | ✓ Implemented |
| Shutdown VPS | `POST /api/vps/:id/shutdown` | `shutdownLinodeInstance()` | `POST /v4/linode/instances/{linodeId}/shutdown` | ✓ Implemented |
| Reboot VPS | `POST /api/vps/:id/reboot` | `rebootLinodeInstance()` | `POST /v4/linode/instances/{linodeId}/reboot` | ✓ Implemented |
| Rebuild VPS | `POST /api/vps/:id/rebuild` | `rebuildLinodeInstance()` | `POST /v4/linode/instances/{linodeId}/rebuild` | ✓ Implemented |
| Delete VPS | `DELETE /api/vps/:id` | `deleteLinodeInstance()` | `DELETE /v4/linode/instances/{linodeId}` | ✓ Implemented |
| Update Hostname | `PUT /api/vps/:id/hostname` | `updateLinodeInstance()` | `PUT /v4/linode/instances/{linodeId}` | ✓ Implemented |
| Toggle Watchdog | `PUT /api/vps/:id/watchdog` | `updateLinodeInstance()` | `PUT /v4/linode/instances/{linodeId}` | ✓ Implemented |
| Update Notes | `PUT /api/vps/:id/notes` | (database only) | N/A | ✓ Implemented |
| Get Uptime Summary | `GET /api/vps/uptime-summary` | (database only) | N/A | ✓ Implemented |

---

## 2. Networking

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get IPs (included in detail) | (via `GET /api/vps/:id`) | `getLinodeInstanceIPs()` | `GET /v4/linode/instances/{linodeId}/ips` | ✓ Implemented |
| Update rDNS (IPv4/IPv6) | `POST /api/vps/:id/networking/rdns` | `updateIPAddressReverseDNS()` | `PUT /v4/networking/ips/{address}` | ✓ Implemented |
| Get IPv6 RDNS Records | `GET /api/vps/:id/networking/ipv6-rdns-records` | `getAccountNetworkingIPs()` | `GET /v4/networking/ips` | ✓ Implemented |
| Get Networking Config | `GET /api/vps/networking/config` | (database) | N/A | ✓ Implemented |
| Get Transfer Usage (included in detail) | (via `GET /api/vps/:id`) | `getLinodeInstanceTransfer()` | `GET /v4/linode/instances/{linodeId}/transfer` | ✓ Implemented |

---

## 3. Backups

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Enable Backups | `POST /api/vps/:id/backups/enable` | `enableLinodeBackups()` | `POST /v4/linode/instances/{linodeId}/backups/enable` | ✓ Implemented |
| Disable Backups | `POST /api/vps/:id/backups/disable` | `cancelLinodeBackups()` | `POST /v4/linode/instances/{linodeId}/backups/cancel` | ✓ Implemented |
| Update Backup Schedule | `POST /api/vps/:id/backups/schedule` | `updateLinodeBackupSchedule()` | `PUT /v4/linode/instances/{linodeId}` (via backups.schedule) | ✓ Implemented |
| Create Snapshot | `POST /api/vps/:id/backups/snapshot` | `createLinodeBackup()` | `POST /v4/linode/instances/{linodeId}/backups` | ✓ Implemented |
| Restore Backup | `POST /api/vps/:id/backups/:backupId/restore` | `restoreLinodeBackup()` | `POST /v4/linode/instances/{linodeId}/backups/{backupId}/restore` | ✓ Implemented |
| Get Backup Info (included in detail) | (via `GET /api/vps/:id`) | `getLinodeInstanceBackups()` | `GET /v4/linode/instances/{linodeId}/backups` | ✓ Implemented |

---

## 4. Firewalls

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Attach Firewall | `POST /api/vps/:id/firewalls/attach` | `attachFirewallToLinode()` | `POST /v4/networking/firewalls/{firewallId}/devices` | ✓ Implemented |
| Detach Firewall | `POST /api/vps/:id/firewalls/detach` | `detachFirewallFromLinode()` | `DELETE /v4/networking/firewalls/{firewallId}/devices/{deviceId}` | ✓ Implemented |
| List Firewalls | (included in detail) | `listFirewalls()`, `getLinodeInstanceFirewalls()` | `GET /v4/networking/firewalls`, `GET /v4/linode/instances/{linodeId}/firewalls` | ✓ Implemented |
| Get Firewall Devices | (included in attach flow) | `getFirewallDevices()` | `GET /v4/networking/firewalls/{firewallId}/devices` | ✓ Implemented |

---

## 5. Disks

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| List Disks | `GET /api/vps/:id/disks` | `listDisks()` | `GET /v4/linode/instances/{linodeId}/disks` | ✓ Implemented |
| Get Disk | `GET /api/vps/:id/disks/:diskId` | `getDisk()` | `GET /v4/linode/instances/{linodeId}/disks/{diskId}` | ✓ Implemented |
| Create Disk | `POST /api/vps/:id/disks` | `createDisk()` | `POST /v4/linode/instances/{linodeId}/disks` | ✓ Implemented |
| Update Disk | `PUT /api/vps/:id/disks/:diskId` | `updateDisk()` | `PUT /v4/linode/instances/{linodeId}/disks/{diskId}` | ✓ Implemented |
| Resize Disk | `POST /api/vps/:id/disks/:diskId/resize` | `resizeDisk()` | `POST /v4/linode/instances/{linodeId}/disks/{diskId}/resize` | ✓ Implemented |
| Clone Disk | `POST /api/vps/:id/disks/:diskId/clone` | `cloneDisk()` | `POST /v4/linode/instances/{linodeId}/disks/{diskId}/clone` | ✓ Implemented |
| Reset Disk Password | `POST /api/vps/:id/disks/:diskId/password` | `resetDiskPassword()` | `POST /v4/linode/instances/{linodeId}/disks/{diskId}/password` | ✓ Implemented |
| Delete Disk | `DELETE /api/vps/:id/disks/:diskId` | `deleteDisk()` | `DELETE /v4/linode/instances/{linodeId}/disks/{diskId}` | ✓ Implemented |

---

## 6. Stats/Metrics

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get Stats (CPU, Network, IO) | (included in `GET /api/vps/:id`) | `getLinodeInstanceStats()` | `GET /v4/linode/instances/{linodeId}/stats` | ✓ Implemented |

---

## 7. Plans/Pricing

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get Plans | `GET /api/vps/plans` | (database only) | N/A | ✓ Implemented |
| Get Plans by Region | `GET /api/vps/providers/:providerId/plans/:regionId` | (database only) | N/A | ✓ Implemented |

---

## 8. Regions

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get Regions | `GET /api/vps/providers/:providerId/regions` | `getLinodeRegions()` | `GET /v4/regions` | ✓ Implemented |

---

## 9. Images/StackScripts

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get Images | `GET /api/vps/images` | `getLinodeImages()` | `GET /v4/images` | ✓ Implemented |
| Get StackScripts | `GET /api/vps/stackscripts` | `getLinodeStackScripts()` | `GET /v4/linode/stackscripts` | ✓ Implemented |
| Get StackScript | `GET /api/vps/stackscripts/:id` | `getStackScript()` | `GET /v4/linode/stackscripts/{stackscriptId}` | ✓ Implemented |
| Create StackScript | `POST /api/vps/stackscripts` | `createStackScript()` | `POST /v4/linode/stackscripts` | ✓ Implemented |
| Update StackScript | `PUT /api/vps/stackscripts/:id` | `updateStackScript()` | `PUT /v4/linode/stackscripts/{stackscriptId}` | ✓ Implemented |

---

## 10. SSH Keys

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get SSH Keys (organization) | `GET /api/vps/providers/:providerId/ssh-keys` | (database only) | N/A | ✓ Implemented |

---

## 11. Providers

| Frontend Action | API Route | Service Method | Linode OpenAPI Path | Status |
|---|---|---|---|---|
| Get Providers | `GET /api/vps/providers` | (database only) | N/A | ✓ Implemented |

---

## Route-to-Service Mapping Summary

### instances.ts
- `GET /` → `getLinodeInstances()`
- `GET /:id` → `getLinodeInstance()`
- `POST /` → `createLinodeInstance()`
- `POST /:id/boot` → `bootLinodeInstance()`
- `POST /:id/shutdown` → `shutdownLinodeInstance()`
- `POST /:id/reboot` → `rebootLinodeInstance()`
- `POST /:id/rebuild` → `rebuildLinodeInstance()`
- `DELETE /:id` → `deleteLinodeInstance()`
- `PUT /:id/hostname` → `updateLinodeInstance()`
- `PUT /:id/watchdog` → `updateLinodeInstance()`
- `PUT /:id/notes` → (database only)

### backups.ts
- `POST /:id/backups/enable` → `enableLinodeBackups()`
- `POST /:id/backups/disable` → `cancelLinodeBackups()`
- `POST /:id/backups/schedule` → `updateLinodeBackupSchedule()`
- `POST /:id/backups/snapshot` → `createLinodeBackup()`
- `POST /:id/backups/:backupId/restore` → `restoreLinodeBackup()`

### networking.ts
- `POST /:id/networking/rdns` → `updateIPAddressReverseDNS()`
- `GET /:id/networking/ipv6-rdns-records` → `getAccountNetworkingIPs()`

### firewalls.ts
- `POST /:id/firewalls/attach` → `attachFirewallToLinode()`
- `POST /:id/firewalls/detach` → `detachFirewallFromLinode()`

### disks.ts
- `GET /:id/disks` → `listDisks()`
- `GET /:id/disks/:diskId` → `getDisk()`
- `POST /:id/disks` → `createDisk()`
- `PUT /:id/disks/:diskId` → `updateDisk()`
- `POST /:id/disks/:diskId/resize` → `resizeDisk()`
- `POST /:id/disks/:diskId/clone` → `cloneDisk()`
- `POST /:id/disks/:diskId/password` → `resetDiskPassword()`
- `DELETE /:id/disks/:diskId` → `deleteDisk()`

### providers.ts
- `GET /providers` → (database only)
- `GET /providers/:providerId/regions` → `getLinodeRegions()`
- `GET /providers/:providerId/plans/:regionId` → (database only)
- `GET /providers/:providerId/ssh-keys` → (database only)
- `GET /networking/config` → (database only)

### stackscripts.ts
- `GET /images` → `getLinodeImages()`
- `GET /stackscripts` → `getLinodeStackScripts()`
- `GET /stackscripts/:id` → `getStackScript()`
- `POST /stackscripts` → `createStackScript()`
- `PUT /stackscripts/:id` → `updateStackScript()`

### plans.ts
- `GET /plans` → (database only)

### stats.ts
- `GET /uptime-summary` → (database only)

---

## Notes

- All routes require authentication (`authenticateToken`) and organization context (`requireOrganization`)
- Permission checks are performed at the route level (e.g., `vps_manage`, `vps_delete`)
- All Linode API calls go through `linodeService.ts` which wraps the Linode API v4 base URL (`https://api.linode.com/v4`)
- The `getLinodeInstance()` call on the detail endpoint also fetches stats, transfer, backups, IPs, firewalls, configs, and events in parallel
- Instance actions (boot/shutdown/reboot) also update the local database record after the provider API call succeeds
- rDNS updates verify IP ownership against the instance's assigned IPs before making the Linode API call
- StackScript and Image routes use the stackscripts router
