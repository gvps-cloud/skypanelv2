# PaaS Integration Implementation Plan (Revised)

Integrate a full Platform-as-a-Service (PaaS) system into SkyPanelV2, providing Heroku-like functionality using **Cloud Native Buildpacks (CNB)** for automatic application building, **uncloud** for container orchestration, and **unregistry** for SSH-based image distribution.

## Confirmed Architecture Decisions

Based on user feedback:

✅ **Buildpack Support**: Use Cloud Native Buildpacks (CNB) via `pack` CLI for Heroku-like deployments  
✅ **Auto-Detection**: Automatically detect Node.js, Python, Ruby, Go, Java, PHP, and other languages  
✅ **No Dockerfile Required**: Clients can deploy by just pushing code (buildpacks handle containerization)  
✅ **Registry Strategy**: SSH-only via unregistry (no HTTP/HTTPS registry)  
✅ **HTTPS/SSL**: Use uncloud's built-in Caddy for automatic HTTPS  
✅ **Integration Approach**: CLI wrapper for uncloud/unregistry/pack  
✅ **Pricing Model**: Dual plans (monthly OR per-resource usage for enterprise)  
✅ **Admin Control**: All workers, plans, and pricing managed from `/admin` dashboard  

**Key Requirements**:
1. Automated setup scripts (`npm run paas:setup`) to install/update uncloud, unregistry, and `pack` CLI
2. **Buildpack workflow**: Clients push code → `pack build` auto-detects language → builds OCI image → pushes to workers via unregistry
3. Support for custom buildpacks and Dockerfile-based builds as fallback
4. Admin dashboard to add/remove/edit worker nodes via SSH credentials + auto-provision
5. Admin dashboard to manage SSH keys across all workers centrally
6. Separate pricing plans for:
   - PaaS applications (monthly or per CPU/RAM/storage/network)
   - Database add-ons (per type: PostgreSQL, MySQL, Redis, etc.)
   - Marketplace 1-click apps (pre-configured pricing per template)
7. All plans are admin-defined (create/edit/delete from dashboard)

---

## Heroku-like Deployment Workflow

The buildpack integration provides the following Heroku-style deployment experience for clients:

### Option 1: Buildpack-Based Deployment (Recommended)

**User Experience**:
1. Client creates a new PaaS application via dashboard
2. Provides Git repository URL (GitHub, GitLab, Bitbucket, etc.)
3. Optionally sets environment variables
4. Clicks "Deploy" - no Dockerfile needed!

**Backend Process**:
```
1. Clone Git repository → /tmp/paas-build-xxx/
2. Run pack CLI auto-detection → Detects Node.js/Python/Ruby/Go/Java/PHP/etc
3. Run pack build → Creates OCI-compliant Docker image using appropriate buildpack
4. Push image to all worker nodes via unregistry (SSH)
5. Deploy to uncloud cluster using docker-compose
6. Automatically provision HTTPS domain via Caddy
7. Application is live!
```

**Supported Languages** (Auto-Detected):
- **Node.js** - detects `package.json`
- **Python** - detects `requirements.txt`, `Pipfile`, `pyproject.toml`
- **Ruby** - detects `Gemfile`
- **Go** - detects `go.mod`
- **Java** - detects `pom.xml`, `build.gradle`
- **PHP** - detects `composer.json`
- **Rust** - detects `Cargo.toml`
- **Static Sites** - HTML/CSS/JS files

### Option 2: Dockerfile-Based Deployment (Fallback)

For applications with specific requirements or custom base images:
1. User includes a `Dockerfile` in their repository
2. System detects Dockerfile and uses `docker build` instead of buildpacks
3. Same deployment flow as Option 1

### Option 3: Custom Buildpacks

For advanced users needing specific buildpack versions or custom buildpacks:
1. User specifies custom buildpack URLs in app settings
2. System passes buildpacks to `pack build --buildpack <url>`
3. Greater control over build process while maintaining simplicity

### Example: Deploying a Node.js App

**User's Repository Structure**:
```
my-nodejs-app/
├── package.json
├── package-lock.json
├── index.js
└── .env.example
```

**User Action**: Push "Deploy" button in SkyPanelV2 dashboard

**System Actions**:
```bash
# 1. Clone repo
$ git clone https://github.com/user/my-nodejs-app /tmp/paas-build-12345

# 2. Auto-detect & build with buildpacks
$ pack build skypanel-my-app:build-1699999999 \
    --builder paketobuildpacks/builder:full \
    --path /tmp/paas-build-12345 \
    --env NODE_ENV=production

# 3. Push to workers via SSH
$ docker pussh skypanel-my-app:build-1699999999 user@worker1.example.com -i /tmp/ssh-key

# 4. Deploy via uncloud
$ uc service deploy my-app -f compose.yaml --cluster default

# 5. Application available at https://my-app.uncloud-cluster-domain.com
```

**No Dockerfile**, **no container knowledge**, **no build configuration** needed!

---

## Multi-Tenant Security Architecture

**Critical Requirement**: Absolute isolation between tenants to prevent cross-tenant access, resource manipulation, and security breaches.

### Network Isolation Strategy

Each tenant's applications will be deployed in isolated Docker networks to prevent cross-tenant communication and resource access:

**Per-Tenant Network Creation**:
```typescript
// When deploying an application
const tenantNetworkName = `tenant_${organizationId}_network`;

// Create isolated network for this tenant if not exists
await execAsync(`docker network create ${tenantNetworkName} --driver bridge --internal || true`);

// Deploy application within tenant-specific network
const composeContent = `
version: '3.8'
services:
  ${appName}:
    image: ${imageName}:${imageTag}
    networks:
      - ${tenantNetworkName}
    labels:
      - "tenant.id=${organizationId}"
      - "app.id=${applicationId}"

networks:
  ${tenantNetworkName}:
    external: true
    name: ${tenantNetworkName}
`;
```

**Network Isolation Benefits**:
1. **No Cross-Tenant Communication**: Containers from different tenants cannot communicate
2. **DNS Isolation**: Tenant networks have separate DNS resolution
3. **Firewall Rules**: iptables rules enforce network boundaries
4. **Traffic Segmentation**: Network traffic is completely separated

**Additional Network Security**:
- Use `--internal` flag for networks that don't need external access
- Implement iptables rules for strict ingress/egress control
- Use uncloud's built-in Caddy for reverse proxy (automatic HTTPS, no direct container exposure)
- Monitor network traffic per tenant for anomalies

---

### Storage Isolation Strategy

Each tenant's application data and volumes are strictly isolated:

**Tenant-Specific Volumes**:
```typescript
// Volume naming convention
const volumeName = `tenant_${organizationId}_app_${applicationId}_data`;

// Create volume with tenant labels
await execAsync(`
  docker volume create ${volumeName} \
    --label tenant.id=${organizationId} \
    --label app.id=${applicationId} \
    --label created.at=${new Date().toISOString()}
`);

// Mount in docker-compose
volumes:
  app_data:
    external: true
    name: ${volumeName}
```

**Storage Isolation Benefits**:
1. **No Cross-Tenant File Access**: Each tenant's data stored separately
2. **Volume Labels**: Easy identification and cleanup per tenant
3. **Backup Isolation**: Tenant-specific backup strategies
4. **Quota Enforcement**: Per-tenant storage quotas

**Storage Security Measures**:
- Encrypt sensitive data at rest (environment variables, secrets)
- Use Docker volume drivers with built-in encryption for sensitive workloads
- Implement storage quotas per tenant via Docker storage drivers
- Regular cleanup of unused volumes with tenant labels

---

### Container Labeling & Resource Tracking

All containers are labeled with tenant and application identifiers:

**Label Schema**:
```yaml
labels:
  tenant.id: "uuid"              # Organization ID
  tenant.name: "Acme Corp"       # Organization name
  app.id: "uuid"                 # Application ID
  app.name: "my-app"             # Application name
  app.slug: "my-app"             # Application slug
  deployment.id: "uuid"          # Deployment ID
  deployment.version: "git-sha"  # Git commit SHA
  pricing.plan: "uuid"           # Pricing plan ID
  created.at: "ISO8601"          # Creation timestamp
  managed.by: "skypanelv2"       # Management system
```

**Usage**:
```bash
# List all containers for a specific tenant
docker ps --filter "label=tenant.id=abc-123"

# Get resource usage for tenant
docker stats --filter "label=tenant.id=abc-123"

# Cleanup tenant resources
docker rm $(docker ps -aq --filter "label=tenant.id=abc-123")
docker volume rm $(docker volume ls -q --filter "label=tenant.id=abc-123")
docker network rm tenant_abc-123_network
```

---

### Security Policies & Access Control

**Container Security**:
```yaml
# In docker-compose.yml
services:
  app:
    security_opt:
      - no-new-privileges:true    # Prevent privilege escalation
    cap_drop:
      - ALL                        # Drop all capabilities
    cap_add:
      - NET_BIND_SERVICE          # Only add what's needed
    read_only: true               # Read-only root filesystem
    tmpfs:
      - /tmp                      # Writable tmp only
    user: "1000:1000"             # Non-root user
```

**AppArmor/SELinux Profiles** (Optional for enhanced security):
```typescript
// Apply AppArmor profile to containers
security_opt:
  - "apparmor:docker-default"
  
// Or custom profile for stricter isolation
security_opt:
  - "apparmor:/etc/apparmor.d/docker-skypanel-tenant"
```

**Resource Quotas Per Tenant**:
```yaml
deploy:
  resources:
    limits:
      cpus: '${MAX_CPU_CORES}'      # From pricing plan
      memory: '${MAX_RAM_GB}G'       # From pricing plan
    reservations:
      cpus: '0.25'
      memory: '256M'
```

---

### Tenant Isolation Implementation Checklist

**When Creating Application**:
1. ✅ Create tenant-specific Docker network (if not exists)
2. ✅ Create tenant-labeled volumes for persistence
3. ✅ Apply tenant labels to all containers
4. ✅ Set resource limits based on pricing plan
5. ✅ Apply security policies (no-new-privileges, cap-drop, read-only)
6. ✅ Deploy in isolated network
7. ✅ Log deployment event with tenant context

**When Starting Application**:
1. ✅ Verify network isolation is active
2. ✅ Check resource quotas not exceeded
3. ✅ Validate tenant ownership
4. ✅ Deploy with proper labels and security context

**When Stopping/Deleting Application**:
1. ✅ Remove containers with tenant labels
2. ✅ Optionally remove volumes (with user confirmation)
3. ✅ Clean up unused networks (if no other apps in tenant)
4. ✅ Log deletion event for audit

**Audit Logging**:
```typescript
// Log all security-relevant events
await query(
  `INSERT INTO security_audit_log 
   (tenant_id, action, resource_type, resource_id, user_id, details, ip_address)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [organizationId, 'app.delete', 'paas_application', applicationId, userId, metadata, ipAddress]
);
```

**Monitoring & Alerts**:
- Monitor for cross-tenant network access attempts
- Alert on unusual resource consumption
- Track deployment failures per tenant
- Monitor for privilege escalation attempts

---

## Proposed Changes

### Automated Setup System

#### [NEW] [scripts/install-uncloud.js](file:///root/skypanelv2/scripts/install-uncloud.js)

Automated uncloud CLI installation script:

**Functionality**:
- Detect operating system (Linux/macOS/Windows)
- Check if uncloud CLI is already installed
- If not installed: download appropriate binary from GitHub releases
- If installed: check version and prompt for update if newer available
- Verify installation by running `uc --version`
- Store installation metadata in `.paas-setup.json`

**Implementation**:
```javascript
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);

async function checkUncloudInstalled() {
  try {
    const { stdout } = await execAsync('uc --version');
    return stdout.trim();
  } catch {
    return null;
  }
}

async function downloadUncloud(platform, arch) {
  // Download from https://github.com/psviderski/uncloud/releases/latest
  // Extract binary to /usr/local/bin/uc (or appropriate path)
}

async function main() {
  console.log('🔍 Checking uncloud installation...');
  const currentVersion = await checkUncloudInstalled();
  
  if (currentVersion) {
    console.log(`✅ Uncloud is installed: ${currentVersion}`);
  } else {
    console.log('📥 Installing uncloud CLI...');
    await downloadUncloud(process.platform, process.arch);
    console.log('✅ Uncloud installed successfully');
  }
}
```

---

#### [NEW] [scripts/install-unregistry.js](file:///root/skypanelv2/scripts/install-unregistry.js)

Automated unregistry Docker plugin installation:

**Functionality**:
- Check if Docker is installed
- Install `docker pussh` plugin (unregistry)
- Verify plugin works
- Store metadata in `.paas-setup.json`

**Implementation**:
```javascript
async function installUnregistryPlugin() {
  console.log('📥 Installing unregistry (docker pussh)...');
  
  // Check Docker installed
  await execAsync('docker --version');
  
  // Install plugin by copying to ~/.docker/cli-plugins/
  // Or using Docker plugin install command
  
  // Verify
  const { stdout } = await execAsync('docker pussh --help');
  if (stdout.includes('pussh')) {
    console.log('✅ Unregistry installed successfully');
  }
}
```

---

#### [NEW] [scripts/install-pack.js](file:///root/skypanelv2/scripts/install-pack.js)

Automated pack CLI installation for Cloud Native Buildpacks:

**Functionality**:
- Detect operating system (Linux/macOS/Windows)
- Check if `pack` CLI is already installed
- If not installed: download appropriate binary from GitHub releases
- If installed: check version and prompt for update if newer available
- Verify installation by running `pack --version`
- Store installation metadata in `.paas-setup.json`

**Implementation**:
```javascript
async function downloadPack(platform, arch) {
  // Download from https://github.com/buildpacks/pack/releases/latest
  // Extract binary to /usr/local/bin/pack (or appropriate path)
  console.log('📥 Downloading pack CLI...');
}

async function main() {
  console.log('🔍 Checking pack CLI installation...');
  const currentVersion = await checkPackInstalled();
  
  if (currentVersion) {
    console.log(`✅ Pack CLI is installed: ${currentVersion}`);
  } else {
    console.log('📥 Installing pack CLI...');
    await downloadPack(process.platform, process.arch);
    console.log('✅ Pack CLI installed successfully');
  }
}
```

---

#### [NEW] [scripts/paas-health-check.js](file:///root/skypanelv2/scripts/paas-health-check.js)

Health check script for PaaS dependencies:

**Checks**:
- Uncloud CLI installed and accessible
- Unregistry plugin installed
- Docker daemon running
- SSH connectivity to configured workers (from database)
- Generate health report

---

#### [MODIFY] [package.json](file:///root/skypanelv2/package.json#L28-L28)

Add PaaS setup scripts:

```json
{
  "scripts": {
    "paas:setup": "node scripts/install-uncloud.js && node scripts/install-unregistry.js && node scripts/install-pack.js",
    "paas:check": "node scripts/paas-health-check.js",
    "paas:update": "npm run paas:setup -- --force-update",
    "postinstall": "npm run paas:check || echo 'PaaS setup incomplete, run: npm run paas:setup'"
  }
}
```

---

### Database Schema & Migrations

#### [NEW] [migrations/004_paas_schema.sql](file:///root/skypanelv2/migrations/004_paas_schema.sql)

Complete PaaS database schema:

**PaaS Worker Nodes** (`paas_worker_nodes`)
```sql
CREATE TABLE paas_worker_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  hostname VARCHAR(255) NOT NULL,
  ssh_port INTEGER DEFAULT 22,
  ssh_username VARCHAR(255) NOT NULL,
  ssh_private_key_encrypted TEXT NOT NULL, -- encrypted with app secret
  region VARCHAR(100),
  uncloud_cluster_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN 
    ('provisioning', 'active', 'degraded', 'offline', 'decommissioned')),
  specifications JSONB DEFAULT '{}', -- {"cpu_cores": 4, "ram_gb": 8, "disk_gb": 160}
  metadata JSONB DEFAULT '{}', -- uncloud version, last provision time, etc.
  last_health_check TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_workers_status ON paas_worker_nodes(status);
CREATE INDEX idx_paas_workers_region ON paas_worker_nodes(region);
```

---

**PaaS Application Pricing Plans** (`paas_app_pricing_plans`)
```sql
CREATE TABLE paas_app_pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL, -- "Hobby", "Professional", "Enterprise"
  description TEXT,
  billing_type VARCHAR(50) NOT NULL CHECK (billing_type IN ('monthly', 'per_resource')),
  
  -- For monthly billing
  price_monthly DECIMAL(10,2),
  
  -- For per-resource billing (hourly rates)
  price_per_cpu_hour DECIMAL(10,4),
  price_per_gb_ram_hour DECIMAL(10,4),
  price_per_gb_storage_hour DECIMAL(10,4),
  price_per_gb_network DECIMAL(10,4),
  
  -- Resource limits for this plan
  max_cpu_cores INTEGER,
  max_ram_gb INTEGER,
  max_storage_gb INTEGER,
  max_network_gb INTEGER,
  
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_app_plans_active ON paas_app_pricing_plans(is_active, display_order);
```

---

**PaaS Applications** (`paas_applications`)```sql
CREATE TABLE paas_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL, -- unique per org
  
  pricing_plan_id UUID REFERENCES paas_app_pricing_plans(id),
  
  -- Git repository
  repository_url VARCHAR(500),
  repository_branch VARCHAR(100) DEFAULT 'main',
  
  -- Build configuration
  build_config JSONB DEFAULT '{}', -- buildpack, Dockerfile path, env vars
  
  -- Domains
  domains JSONB DEFAULT '[]', -- ["app.example.com", "app2.example.com"]
  
  -- Deployment configuration
  worker_node_ids JSONB DEFAULT '[]', -- UUIDs of workers to deploy to
  target_instances INTEGER DEFAULT 1, -- number of replicas
  
  -- Status
  status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN 
    ('inactive', 'deploying', 'running', 'failed', 'stopped')),
  health_check_url VARCHAR(500),
  last_deployed_at TIMESTAMP WITH TIME ZONE,
  
  -- Resource usage tracking (for per-resource billing)
  current_cpu_cores DECIMAL(5,2) DEFAULT 0,
  current_ram_gb DECIMAL(5,2) DEFAULT 0,
  current_storage_gb DECIMAL(10,2) DEFAULT 0,
  network_usage_gb DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_paas_apps_org ON paas_applications(organization_id);
CREATE INDEX idx_paas_apps_status ON paas_applications(status);
CREATE INDEX idx_paas_apps_plan ON paas_applications(pricing_plan_id);
```

---

**PaaS Application Port Mappings** (`paas_app_ports`)
```sql
CREATE TABLE paas_app_ports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  
  -- Port configuration
  container_port INTEGER NOT NULL, -- internal port in container (e.g., 3000, 8080)
  external_port INTEGER, -- optional external port, NULL for auto-assigned
  protocol VARCHAR(10) DEFAULT 'tcp' CHECK (protocol IN ('tcp', 'udp', 'http', 'https')),
  
  -- HTTPS/domain mapping (if using Caddy auto-HTTPS)
  domain VARCHAR(255), -- if specified, maps this port to a domain via Caddy
  
  is_primary BOOLEAN DEFAULT FALSE, -- primary port for the application
  description VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(application_id, container_port)
);

CREATE INDEX idx_paas_app_ports_app ON paas_app_ports(application_id);
```

---

**PaaS Application Environment Variables** (`paas_app_env_vars`)
```sql
CREATE TABLE paas_app_env_vars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  
  key VARCHAR(255) NOT NULL,
  value_encrypted TEXT NOT NULL, -- encrypted with app secret
  
  -- Metadata
  is_buildtime BOOLEAN DEFAULT FALSE, -- if true, available during build process
  is_runtime BOOLEAN DEFAULT TRUE, -- if true, available at runtime
  description VARCHAR(500),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(application_id, key)
);

CREATE INDEX idx_paas_app_env_vars_app ON paas_app_env_vars(application_id);
```

---

**PaaS Deployments** (`paas_deployments`)
```sql
CREATE TABLE paas_deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  version VARCHAR(255), -- git commit SHA or version tag
  trigger_type VARCHAR(50) CHECK (trigger_type IN ('manual', 'git_push', 'marketplace_install')),
  
  -- Build/deployment process
  build_log_path VARCHAR(500), -- path to build logs file
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN 
    ('pending', 'building', 'deploying', 'success', 'failed', 'rolled_back')),
  error_message TEXT,
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  deployed_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_deployments_app ON paas_deployments(application_id, created_at DESC);
CREATE INDEX idx_paas_deployments_status ON paas_deployments(status);
```

---

**PaaS Add-on Pricing Plans** (`paas_addon_pricing_plans`)
```sql
CREATE TABLE paas_addon_pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  addon_type VARCHAR(50) NOT NULL CHECK (addon_type IN 
    ('postgres', 'mysql', 'redis', 'mongodb', 'elasticsearch')),
  plan_name VARCHAR(255) NOT NULL, -- "Hobby", "Standard", "Professional"
  description TEXT,
  
  -- Pricing
  price_hourly DECIMAL(10,4),
  price_monthly DECIMAL(10,2),
  
  -- Specifications
  specifications JSONB NOT NULL DEFAULT '{}', -- {"storage_gb": 10, "max_connections": 20}
  
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(addon_type, plan_name)
);

CREATE INDEX idx_addon_plans_type ON paas_addon_pricing_plans(addon_type, is_active);
```

---

**PaaS Add-ons** (`paas_addons`)
```sql
CREATE TABLE paas_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id UUID REFERENCES paas_applications(id) ON DELETE SET NULL, -- can be standalone
  
  addon_type VARCHAR(50) NOT NULL,
  pricing_plan_id UUID REFERENCES paas_addon_pricing_plans(id),
  name VARCHAR(255) NOT NULL,
  
  -- Connection details (encrypted)
  connection_config_encrypted TEXT NOT NULL,
  
  -- Hosting
  worker_node_id UUID REFERENCES paas_worker_nodes(id),
  
  status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN 
    ('provisioning', 'available', 'upgrading', 'failing', 'deleted')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_addons_org ON paas_addons(organization_id);
CREATE INDEX idx_paas_addons_app ON paas_addons(application_id);
CREATE INDEX idx_paas_addons_type ON paas_addons(addon_type);
```

---

**PaaS Marketplace Templates** (`paas_marketplace_templates`)
```sql
CREATE TABLE paas_marketplace_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL, -- "WordPress", "Ghost", "n8n"
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(500),
  category VARCHAR(100), -- "CMS", "Automation", "E-commerce"
  
  -- Template configuration
  git_repository VARCHAR(500) NOT NULL, -- template repo URL
  git_branch VARCHAR(100) DEFAULT 'main',
  default_build_config JSONB DEFAULT '{}',
  required_addons JSONB DEFAULT '[]', -- ["postgres", "redis"]
  
  -- Pricing
  pricing_plan_id UUID REFERENCES paas_app_pricing_plans(id),
  
  is_enabled BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_marketplace_templates_enabled ON paas_marketplace_templates(is_enabled, display_order);
CREATE INDEX idx_marketplace_templates_category ON paas_marketplace_templates(category);
```

---

**PaaS Billing Cycles** (`paas_billing_cycles`)
```sql
CREATE TABLE paas_billing_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- What was billed
  application_id UUID REFERENCES paas_applications(id) ON DELETE SET NULL,
  addon_id UUID REFERENCES paas_addons(id) ON DELETE SET NULL,
  
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Billing details
  billing_type VARCHAR(50) CHECK (billing_type IN ('monthly', 'per_resource')),
  hourly_rate DECIMAL(10,4),
  hours_charged DECIMAL(10,2),
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Resource usage details (for per-resource billing)
  resource_usage JSONB DEFAULT '{}', -- {"cpu_hours": 24, "ram_gb_hours": 48}
  
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'failed', 'refunded')),
  payment_transaction_id UUID REFERENCES payment_transactions(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paas_billing_org ON paas_billing_cycles(organization_id);
CREATE INDEX idx_paas_billing_app ON paas_billing_cycles(application_id);
CREATE INDEX idx_paas_billing_addon ON paas_billing_cycles(addon_id);
CREATE INDEX idx_paas_billing_period ON paas_billing_cycles(billing_period_start, billing_period_end);
CREATE INDEX idx_paas_billing_status ON paas_billing_cycles(status);
```

**Triggers**:
```sql
CREATE TRIGGER update_paas_worker_nodes_updated_at
BEFORE UPDATE ON paas_worker_nodes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Similar triggers for other tables...
```

---

### Backend Services

#### [NEW] [api/services/uncloudService.ts](file:///root/skypanelv2/api/services/uncloudService.ts)

Core service for uncloud CLI interactions:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export class UncloudService {
  /**
   * Initialize new uncloud cluster on a worker node
   */
  static async initializeCluster(params: {
    workerName: string;
    sshHost: string;
    sshUser: string;
    sshKeyPath: string;
  }): Promise<{clusterId: string; domain: string}> {
    const { workerName, sshHost, sshUser, sshKeyPath } = params;
    
    const command = `uc machine init --name ${workerName} ${sshUser}@${sshHost} -i ${sshKeyPath}`;
    
    try {
      const { stdout } = await execAsync(command);
      
      // Parse output to extract cluster ID and domain
      const clusterIdMatch = stdout.match(/Cluster "([^"]+)" initialised/);
      const domainMatch = stdout.match(/Reserved cluster domain: ([^\s]+)/);
      
      return {
        clusterId: clusterIdMatch?.[1] || 'default',
        domain: domainMatch?.[1] || ''
      };
    } catch (error) {
      throw new Error(`Failed to initialize uncloud cluster: ${error.message}`);
    }
  }

  /**
   * Add machine to existing cluster
   */
  static async addMachineToCluster(params: {
    workerName: string;
    sshHost: string;
    sshUser: string;
    sshKeyPath: string;
    clusterId: string;
  }): Promise<void> {
    const { workerName, sshHost, sshUser, sshKeyPath, clusterId } = params;
    
    const command = `uc machine add --name ${workerName} ${sshUser}@${sshHost} -i ${sshKeyPath} --cluster ${clusterId}`;
    
    await execAsync(command);
  }

  /**
   * Deploy service using Docker Compose
   */
  static async deployService(params: {
    serviceName: string;
    composeContent: string;
    clusterId: string;
  }): Promise<{success: boolean; output: string}> {
    const { serviceName, composeContent, clusterId } = params;
    
    // Write compose file to temp location
    const tempDir = await fs.mkdtemp('/tmp/uncloud-deploy-');
    const composePath = path.join(tempDir, 'compose.yaml');
    await fs.writeFile(composePath, composeContent);
    
    try {
      const command = `uc service deploy ${serviceName} -f ${composePath} --cluster ${clusterId}`;
      const { stdout } = await execAsync(command);
      
      return { success: true, output: stdout };
    } finally {
      // Cleanup temp file
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Remove service from cluster
   */
  static async removeService(serviceName: string, clusterId: string): Promise<void> {
    const command = `uc service rm ${serviceName} --cluster ${clusterId}`;
    await execAsync(command);
  }

  /**
   * List machines in cluster
   */
  static async listMachines(clusterId: string): Promise<MachineInfo[]> {
    const command = `uc machine ls --cluster ${clusterId} --json`;
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout);
  }

  /**
   * Test SSH connection to worker
   */
  static async testSshConnection(params: {
    sshHost: string;
    sshUser: string;
    sshKeyPath: string;
    sshPort: number;
  }): Promise<{success: boolean; message: string}> {
    const { sshHost, sshUser, sshKeyPath, sshPort } = params;
    
    try {
      const command = `ssh -i ${sshKeyPath} -p ${sshPort} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${sshUser}@${sshHost} 'echo "Connection successful"'`;
      const { stdout } = await execAsync(command);
      
      return {
        success: stdout.includes('Connection successful'),
        message: 'SSH connection test passed'
      };
    } catch (error) {
      return {
        success: false,
        message: `SSH connection failed: ${error.message}`
      };
    }
  }
}

interface MachineInfo {
  name: string;
  status: string;
  ip: string;
}
```

---

#### [NEW] [api/services/unregistryService.ts](file:///root/skypanelv2/api/services/unregistryService.ts)

Service for pushing images via unregistry:

```typescript
export class UnregistryService {
  /**
   * Push Docker image to remote worker via SSH
   */
  static async pushImage(params: {
    imageName: string;
    imageTag: string;
    sshHost: string;
    sshUser: string;
    sshKeyPath: string;
    sshPort?: number;
  }): Promise<{success: boolean; output: string}> {
    const { imageName, imageTag, sshHost, sshUser, sshKeyPath, sshPort = 22 } = params;
    
    const fullImage = `${imageName}:${imageTag}`;
    const sshTarget = sshPort === 22 
      ? `${sshUser}@${sshHost}`
      : `${sshUser}@${sshHost}:${sshPort}`;
    
    const command = `docker pussh ${fullImage} ${sshTarget} -i ${sshKeyPath}`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      return { success: true, output: stdout + stderr };
    } catch (error) {
      throw new Error(`Failed to push image via unregistry: ${error.message}`);
    }
  }
}
```

---

#### [NEW] [api/services/buildpackService.ts](file:///root/skypanelv2/api/services/buildpackService.ts)

Core service for Cloud Native Buildpacks integration:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

const execAsync = promisify(exec);

interface BuildResult {
  success: boolean;
  imageName: string;
  imageTag: string;
  buildLog: string;
  detectedLanguage?: string;
}

export class BuildpackService {
  private static readonly DEFAULT_BUILDER = 'paketobuildpacks/builder:full';
  private static readonly BUILD_TIMEOUT_MS = parseInt(process.env.PAAS_BUILD_TIMEOUT_MS || '600000'); // 10 min

  /**
   * Auto-detect language/framework from application source code
   */
  static async detectLanguage(sourceDir: string): Promise<string | null> {
    try {
      // Check for common language indicators
      const files = await fs.readdir(sourceDir);
      
      if (files.includes('package.json')) return 'Node.js';
      if (files.includes('requirements.txt') || files.includes('Pipfile')) return 'Python';
      if (files.includes('Gemfile')) return 'Ruby';
      if (files.includes('go.mod')) return 'Go';
      if (files.includes('pom.xml') || files.includes('build.gradle')) return 'Java';
      if (files.includes('composer.json')) return 'PHP';
      if (files.includes('Cargo.toml')) return 'Rust';
      
      return null;
    } catch (error) {
      console.error('Language detection failed:', error);
      return null;
    }
  }

  /**
   * Build application using Cloud Native Buildpacks
   * This is the core method that provides Heroku-like functionality
   */
  static async buildWithBuildpacks(params: {
    appName: string;
    sourceDir: string;
    builder?: string;
    env?: Record<string, string>;
    customBuildpacks?: string[];
  }): Promise<BuildResult> {
    const { appName, sourceDir, builder = this.DEFAULT_BUILDER, env = {}, customBuildpacks } = params;
    
    const imageName = `skypanel-${appName}`;
    const imageTag = `build-${Date.now()}`;
    const fullImageName = `${imageName}:${imageTag}`;
    
    let buildLog = '';
    
    try {
      // Detect language for logging
      const detectedLanguage = await this.detectLanguage(sourceDir);
      buildLog += `[DETECT] Language detected: ${detectedLanguage || 'Unknown'}\n`;
      
      // Prepare environment variables
      const envArgs = Object.entries(env)
        .map(([key, value]) => `--env ${key}="${value}"`)
        .join(' ');
      
      // Prepare buildpack args if custom buildpacks specified
      const buildpackArgs = customBuildpacks
        ? customBuildpacks.map(bp => `--buildpack ${bp}`).join(' ')
        : '';
      
      // Build command using pack CLI
      const command = [
        'pack build',
        fullImageName,
        `--builder ${builder}`,
        `--path ${sourceDir}`,
        envArgs,
        buildpackArgs,
        '--trust-builder',
        '--pull-policy if-not-present'
      ].filter(Boolean).join(' ');
      
      buildLog += `[BUILD] Running: ${command}\n\n`;
      
      // Execute build with timeout
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: this.BUILD_TIMEOUT_MS
      });
      
      buildLog += stdout;
      if (stderr) buildLog += `\n[STDERR]\n${stderr}`;
      
      buildLog += `\n[SUCCESS] Image built: ${fullImageName}\n`;
      
      return {
        success: true,
        imageName,
        imageTag,
        buildLog,
        detectedLanguage: detectedLanguage || undefined
      };
      
    } catch (error: any) {
      buildLog += `\n[ERROR] Build failed: ${error.message}\n`;
      if (error.stdout) buildLog += error.stdout;
      if (error.stderr) buildLog += `\n${error.stderr}`;
      
      throw new Error(buildLog);
    }
  }

  /**
   * Build from Dockerfile (fallback option)
   */
  static async buildWithDockerfile(params: {
    appName: string;
    sourceDir: string;
    dockerfilePath?: string;
  }): Promise<BuildResult> {
    const { appName, sourceDir, dockerfilePath = 'Dockerfile' } = params;
    
    const imageName = `skypanel-${appName}`;
    const imageTag = `build-${Date.now()}`;
    const fullImageName = `${imageName}:${imageTag}`;
    
    const dockerfileFullPath = path.join(sourceDir, dockerfilePath);
    
    // Check if Dockerfile exists
    try {
      await fs.access(dockerfileFullPath);
    } catch {
      throw new Error(`Dockerfile not found at ${dockerfileFullPath}`);
    }
    
    const command = `docker build -t ${fullImageName} -f ${dockerfileFullPath} ${sourceDir}`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: this.BUILD_TIMEOUT_MS
      });
      
      const buildLog = `[DOCKERFILE BUILD]\n${stdout}\n${stderr}`;
      
      return {
        success: true,
        imageName,
        imageTag,
        buildLog
      };
    } catch (error: any) {
      const buildLog = `[ERROR] Dockerfile build failed\n${error.stdout || ''}\n${error.stderr || ''}`;
      throw new Error(buildLog);
    }
  }

  /**
   * Clone Git repository to temporary directory
   */
  static async cloneRepository(params: {
    repositoryUrl: string;
    branch: string;
  }): Promise<string> {
    const { repositoryUrl, branch } = params;
    
    const tempDir = await fs.mkdtemp('/tmp/paas-build-');
    const git: SimpleGit = simpleGit();
    
    try {
      await git.clone(repositoryUrl, tempDir, ['--branch', branch, '--depth', '1']);
      return tempDir;
    } catch (error) {
      // Cleanup on failure
      await fs.rm(tempDir, { recursive: true, force: true });
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Cleanup temporary build directory
   */
  static async cleanupBuildDir(buildDir: string): Promise<void> {
    try {
      await fs.rm(buildDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup build directory:', error);
    }
  }

  /**
   * Get available builders
   */
  static async listBuilders(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('pack builder suggest');
      // Parse output to get builder names
      return stdout.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim());
    } catch {
      return [this.DEFAULT_BUILDER];
    }
  }
}
```

---

#### [NEW] [api/services/paasWorkerService.ts](file:///root/skypanelv2/api/services/paasWorkerService.ts)

Worker node provisioning and management:

```typescript
import { query } from '../lib/database.js';
import { UncloudService } from './uncloudService.js';
import { encryptData, decryptData } from '../lib/encryption.js';
import fs from 'fs/promises';
import path from 'path';

export class PaaSWorkerService {
  /**
   * Provision new worker node
   * 1. Test SSH connection
   * 2. Save SSH key to temp file
   * 3. Initialize or join uncloud cluster
   * 4. Save worker to database
   */
  static async provisionWorker(params: {
    name: string;
    hostname: string;
    sshPort: number;
    sshUsername: string;
    sshPrivateKey: string;
    region?: string;
    specifications?: object;
  }): Promise<{id: string; status: string; clusterDomain: string}> {
    const { name, hostname, sshPort, sshUsername, sshPrivateKey, region, specifications } = params;
    
    // 1. Test SSH connection
    const tempKeyPath = await this.saveTempSshKey(sshPrivateKey);
    
    try {
      const connectionTest = await UncloudService.testSshConnection({
        sshHost: hostname,
        sshUser: sshUsername,
        sshKeyPath: tempKeyPath,
        sshPort
      });
      
      if (!connectionTest.success) {
        throw new Error(connectionTest.message);
      }
      
      // 2. Check if this is the first worker (initialize cluster) or additional worker
      const existingWorkers = await query('SELECT * FROM paas_worker_nodes LIMIT 1');
      
      let clusterId: string;
      let clusterDomain: string;
      
      if (existingWorkers.rows.length === 0) {
        // First worker - initialize cluster
        const result = await UncloudService.initializeCluster({
          workerName: name,
          sshHost: hostname,
          sshUser: sshUsername,
          sshKeyPath: tempKeyPath
        });
        
        clusterId = result.clusterId;
        clusterDomain = result.domain;
      } else {
        // Additional worker - join existing cluster
        const firstWorker = existingWorkers.rows[0];
        clusterId = firstWorker.uncloud_cluster_id;
        clusterDomain = ''; // Will use same domain as cluster
        
        await UncloudService.addMachineToCluster({
          workerName: name,
          sshHost: hostname,
          sshUser: sshUsername,
          sshKeyPath: tempKeyPath,
          clusterId
        });
      }
      
      // 3. Encrypt and save to database
      const encryptedKey = encryptData(sshPrivateKey);
      
      const insertResult = await query(
        `INSERT INTO paas_worker_nodes 
        (name, hostname, ssh_port, ssh_username, ssh_private_key_encrypted, region, 
         uncloud_cluster_id, status, specifications)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [name, hostname, sshPort, sshUsername, encryptedKey, region, 
         clusterId, 'active', JSON.stringify(specifications || {})]
      );
      
      return {
        id: insertResult.rows[0].id,
        status: 'active',
        clusterDomain
      };
      
    } finally {
      // Cleanup temp key
      await fs.unlink(tempKeyPath).catch(() => {});
    }
  }

  /**
   * Health check worker
   */
  static async healthCheckWorker(workerId: string): Promise<{healthy: boolean; message: string}> {
    // Test SSH connection
    // Check uncloudd service status
    // Update last_health_check timestamp
    return { healthy: true, message: 'Worker is operational' };
  }

  /**
   * Decommission worker
   */
  static async decommissionWorker(workerId: string): Promise<void> {
    // TODO: Migrate applications to other workers
    // Remove from uncloud cluster
    // Mark as decommissioned in database
  }

  /**
   * Update SSH key across all workers
   */
  static async updateSshKeyAllWorkers(newPrivateKey: string): Promise<void> {
    const workers = await query('SELECT * FROM paas_worker_nodes WHERE status = $1', ['active']);
    
    for (const worker of workers.rows) {
      // Test connection with new key
      // If successful, update database
    }
  }

  private static async saveTempSshKey(keyContent: string): Promise<string> {
    const tempPath = path.join('/tmp', `paas-ssh-key-${Date.now()}`);
    await fs.writeFile(tempPath, keyContent, { mode: 0o600 });
    return tempPath;
}
```

---

#### [NEW] [api/services/paasApplicationService.ts](file:///root/skypanelv2/api/services/paasApplicationService.ts)

Application lifecycle management service - **New requirement from user feedback**:

> **User Requirement**: Clients should be able to start/stop/delete PaaS applications, manage ports for their applications, and manage environments like other PaaS systems.

**Key Features**:
1. **Application Lifecycle**: Create, start, stop, delete applications
2. **Port Management**: Add, update, remove port mappings
3. **Environment Variables**: CRUD operations for environment variables
4. **State Management**: Track application states and ensure proper transitions

```typescript
import { query } from '../lib/database.js';
import { UncloudService } from './uncloudService.js';
import {encryptData, decryptData } from '../lib/encryption.js';

interface PortMapping {
  containerPort: number;
  externalPort?: number;
  protocol: 'tcp' | 'udp' | 'http' | 'https';
  domain?: string;
  isPrimary: boolean;
  description?: string;
}

interface EnvironmentVariable {
  key: string;
  value: string;
  isBuildtime: boolean;
  isRuntime: boolean;
  description?: string;
}

export class PaaSApplicationService {
  /**
   * START APPLICATION
   * Starts a stopped application by deploying to uncloud cluster
   */
  static async startApplication(params: {
    applicationId: string;
    organizationId: string;
  }): Promise<{success: boolean; message: string}> {
    const { applicationId, organizationId } = params;
    
    try {
      // 1. Get application details
      const appResult = await query(
        `SELECT * FROM paas_applications 
         WHERE id = $1 AND organization_id = $2`,
        [applicationId, organizationId]
      );
      
      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }
      
      const app = appResult.rows[0];
      
      // 2. Check if already running
      if (app.status === 'running') {
        return { success: true, message: 'Application is already running' };
      }
      
      // 3. Update status to deploying
      await query(
        `UPDATE paas_applications SET status = 'deploying', updated_at = NOW() 
         WHERE id = $1`,
        [applicationId]
      );
      
      // 4. Get latest deployment configuration
      const latestDeployment = await query(
        `SELECT * FROM paas_deployments 
         WHERE application_id = $1 AND status = 'success' 
         ORDER BY created_at DESC LIMIT 1`,
        [applicationId]
      );
      
      if (latestDeployment.rows.length === 0) {
        throw new Error('No successful deployment found. Please deploy the application first.');
      }
      
      // 5. Get port mappings
      const ports = await this.getPortMappings(applicationId);
      
      // 6. Get environment variables
      const envVars = await this.getEnvironmentVariables(applicationId);
      
      // 7. Generate docker-compose configuration
      const composeContent = await this.generateDockerCompose({
        appName: app.slug,
        imageName: `skypanel-${app.slug}`,
        imageTag: latestDeployment.rows[0].version,
        ports,
        envVars: envVars.filter(v => v.isRuntime),
        targetInstances: app.target_instances
      });
      
      // 8. Deploy to uncloud cluster
      const deployResult = await UncloudService.deployService({
        serviceName: app.slug,
        composeContent,
        clusterId: JSON.parse(app.worker_node_ids)[0] // Get first worker's cluster
      });
      
      if (!deployResult.success) {
        throw new Error(`Deployment failed: ${deployResult.output}`);
      }
      
      // 9. Update status to running
      await query(
        `UPDATE paas_applications 
         SET status = 'running', last_deployed_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [applicationId]
      );
      
      return { success: true, message: 'Application started successfully' };
      
    } catch (error: any) {
      // Update status to failed
      await query(
        `UPDATE paas_applications SET status = 'failed', updated_at = NOW() 
         WHERE id = $1`,
        [applicationId]
      );
      
      throw new Error(`Failed to start application: ${error.message}`);
    }
  }

  /**
   * STOP APPLICATION
   * Stops a running application by removing it from uncloud cluster
   */
  static async stopApplication(params: {
    applicationId: string;
    organizationId: string;
  }): Promise<{success: boolean; message: string}> {
    const { applicationId, organizationId } = params;
    
    try {
      // 1. Get application details
      const appResult = await query(
        `SELECT * FROM paas_applications 
         WHERE id = $1 AND organization_id = $2`,
        [applicationId, organizationId]
      );
      
      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }
      
      const app = appResult.rows[0];
      
      // 2. Check if already stopped
      if (app.status === 'stopped' || app.status === 'inactive') {
        return { success: true, message: 'Application is already stopped' };
      }
      
      // 3. Remove from uncloud cluster
      const clusterId = JSON.parse(app.worker_node_ids)[0];
      await UncloudService.removeService({
        serviceName: app.slug,
        clusterId
      });
      
      // 4. Update status
      await query(
        `UPDATE paas_applications SET status = 'stopped', updated_at = NOW() 
         WHERE id = $1`,
        [applicationId]
      );
      
      return { success: true, message: 'Application stopped successfully' };
      
    } catch (error: any) {
      throw new Error(`Failed to stop application: ${error.message}`);
    }
  }

  /**
   * DELETE APPLICATION
   * Permanently deletes application and all associated resources
   */
  static async deleteApplication(params: {
    applicationId: string;
    organizationId: string;
  }): Promise<{success: boolean; message: string}> {
    const { applicationId, organizationId } = params;
    
    try {
      // 1. Get application details
      const appResult = await query(
        `SELECT * FROM paas_applications 
         WHERE id = $1 AND organization_id = $2`,
        [applicationId, organizationId]
      );
      
      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }
      
      const app = appResult.rows[0];
      
      // 2. Stop application if running
      if (app.status === 'running') {
        await this.stopApplication({ applicationId, organizationId });
      }
      
      // 3. Delete from uncloud cluster (remove images, volumes)
      const clusterId = JSON.parse(app.worker_node_ids)[0];
      await UncloudService.cleanupService({
        serviceName: app.slug,
        clusterId
      });
      
      // 4. Delete from database (cascade will handle related records)
      await query(
        `DELETE FROM paas_applications WHERE id = $1`,
        [applicationId]
      );
      
      return { success: true, message: 'Application deleted successfully' };
      
    } catch (error: any) {
      throw new Error(`Failed to delete application: ${error.message}`);
    }
  }

  /**
   * PORT MANAGEMENT - Add port mapping
   */
  static async addPortMapping(params: {
    applicationId: string;
    organizationId: string;
    port: PortMapping;
  }): Promise<{id: string; port: PortMapping}> {
    const { applicationId, organizationId, port } = params;
    
    // Verify application ownership
    await this.verifyApplicationOwnership(applicationId, organizationId);
    
    // Insert port mapping
    const result = await query(
      `INSERT INTO paas_app_ports 
       (application_id, container_port, external_port, protocol, domain, is_primary, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        applicationId,
        port.containerPort,
        port.externalPort,
        port.protocol,
        port.domain,
        port.isPrimary,
        port.description
      ]
    );
    
    return { id: result.rows[0].id, port };
  }

  /**
   * PORT MANAGEMENT - Update port mapping
   */
  static async updatePortMapping(params: {
    portId: string;
    organizationId: string;
    updates: Partial<PortMapping>;
  }): Promise<{success: boolean}> {
    const { portId, organizationId, updates } = params;
    
    // Build dynamic UPDATE query
    const updateFields = Object.keys(updates)
      .map((key, idx) => `${this.camelToSnake(key)} = $${idx + 2}`)
      .join(', ');
    
    const values = [portId, ...Object.values(updates)];
    
    await query(
      `UPDATE paas_app_ports p
       SET ${updateFields}, updated_at = NOW()
       FROM paas_applications a
       WHERE p.id = $1 AND p.application_id = a.id 
       AND a.organization_id = $${values.length + 1}`,
      [...values, organizationId]
    );
    
    return { success: true };
  }

  /**
   * PORT MANAGEMENT - Remove port mapping
   */
  static async removePortMapping(params: {
    portId: string;
    organizationId: string;
  }): Promise<{success: boolean}> {
    const { portId, organizationId } = params;
    
    await query(
      `DELETE FROM paas_app_ports p
       USING paas_applications a
       WHERE p.id = $1 AND p.application_id = a.id 
       AND a.organization_id = $2`,
      [portId, organizationId]
    );
    
    return { success: true };
  }

  /**
   * PORT MANAGEMENT - Get all port mappings
   */
  static async getPortMappings(applicationId: string): Promise<PortMapping[]> {
    const result = await query(
      `SELECT * FROM paas_app_ports WHERE application_id = $1 ORDER BY is_primary DESC, container_port ASC`,
      [applicationId]
    );
    
    return result.rows.map(row => ({
      containerPort: row.container_port,
      externalPort: row.external_port,
      protocol: row.protocol,
      domain: row.domain,
      isPrimary: row.is_primary,
      description: row.description
    }));
  }

  /**
   * ENVIRONMENT VARIABLES - Add or update
   */
  static async setEnvironmentVariable(params: {
    applicationId: string;
    organizationId: string;
    envVar: EnvironmentVariable;
  }): Promise<{success: boolean}> {
    const { applicationId, organizationId, envVar } = params;
    
    // Verify ownership
    await this.verifyApplicationOwnership(applicationId, organizationId);
    
    // Encrypt value
    const encryptedValue = encryptData(envVar.value);
    
    // Upsert
    await query(
      `INSERT INTO paas_app_env_vars 
       (application_id, key, value_encrypted, is_buildtime, is_runtime, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (application_id, key) 
       DO UPDATE SET 
         value_encrypted = EXCLUDED.value_encrypted,
         is_buildtime = EXCLUDED.is_buildtime,
         is_runtime = EXCLUDED.is_runtime,
         description = EXCLUDED.description,
         updated_at = NOW()`,
      [
        applicationId,
        envVar.key,
        encryptedValue,
        envVar.isBuildtime,
        envVar.isRuntime,
        envVar.description
      ]
    );
    
    return { success: true };
  }

  /**
   * ENVIRONMENT VARIABLES - Delete
   */
  static async deleteEnvironmentVariable(params: {
    applicationId: string;
    organizationId: string;
    key: string;
  }): Promise<{success: boolean}> {
    const { applicationId, organizationId, key } = params;
    
    // Verify ownership
    await this.verifyApplicationOwnership(applicationId, organizationId);
    
    await query(
      `DELETE FROM paas_app_env_vars WHERE application_id = $1 AND key = $2`,
      [applicationId, key]
    );
    
    return { success: true };
  }

  /**
   * ENVIRONMENT VARIABLES - Get all
   */
  static async getEnvironmentVariables(applicationId: string): Promise<EnvironmentVariable[]> {
    const result = await query(
      `SELECT * FROM paas_app_env_vars WHERE application_id = $1 ORDER BY key ASC`,
      [applicationId]
    );
    
    return result.rows.map(row => ({
      key: row.key,
      value: decryptData(row.value_encrypted),
      isBuildtime: row.is_buildtime,
      isRuntime: row.is_runtime,
      description: row.description
    }));
  }

  // Helper methods
  private static async verifyApplicationOwnership(
    applicationId: string,
    organizationId: string
  ): Promise<void> {
    const result = await query(
      `SELECT id FROM paas_applications WHERE id = $1 AND organization_id = $2`,
      [applicationId, organizationId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Application not found or access denied');
    }
  }

  private static async generateDockerCompose(params: {
    appName: string;
    imageName: string;
    imageTag: string;
    ports: PortMapping[];
    envVars: EnvironmentVariable[];
    targetInstances: number;
  }): Promise<string> {
    const { appName, imageName, imageTag, ports, envVars, targetInstances } = params;
    
    // Generate docker-compose.yml content
    const portMappings = ports
      .map(p => `      - "${p.externalPort || ''}:${p.containerPort}"`)
      .join('\n');
    
    const environment = envVars
      .map(e => `      ${e.key}: "${e.value}"`)
      .join('\n');
    
    return `
version: '3.8'
services:
  ${appName}:
    image: ${imageName}:${imageTag}
    deploy:
      replicas: ${targetInstances}
      restart_policy:
        condition: on-failure
    ports:
${portMappings}
    environment:
${environment}
    networks:
      - ${appName}_network

networks:
  ${appName}_network:
    driver: bridge
`.trim();
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
```

---

### Backend API Endpoints

#### [NEW] [api/routes/admin/paasWorkers.ts](file:///root/skypanelv2/api/routes/admin/paasWorkers.ts)

Admin routes for managing worker nodes:

```typescript
import express from 'express';
import { PaaSWorkerService } from '../../services/paasWorkerService.js';

const router = express.Router();

/**
 * GET /api/admin/paas/workers
 * List all worker nodes
 */
router.get('/', async (req, res) => {
  const workers = await query('SELECT * FROM paas_worker_nodes ORDER BY created_at DESC');
  res.json({ workers: workers.rows });
});

/**
 * POST /api/admin/paas/workers
 * Add and provision new worker node
 */
router.post('/', async (req, res) => {
  const { name, hostname, sshPort, sshUsername, sshPrivateKey, region, specifications } = req.body;
  
  try {
    const result = await PaaSWorkerService.provisionWorker({
      name,
      hostname,
      sshPort: sshPort || 22,
      sshUsername,
      sshPrivateKey,
      region,
      specifications
    });
    
    res.json({ success: true, worker: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/paas/workers/:id/test-connection
 * Test SSH connection to worker
 */
router.post('/:id/test-connection', async (req, res) => {
  // Implementation
});

/**
 * DELETE /api/admin/paas/workers/:id
 * Decommission worker
 */
router.delete('/:id', async (req, res) => {
  await PaaSWorkerService.decommissionWorker(req.params.id);
  res.json({ success: true });
});

export default router;
```

---

#### [NEW] [api/routes/admin/paasPricing.ts](file:///root/skypanelv2/api/routes/admin/paasPricing.ts)

Admin pricing plans management:

```typescript
/**
 * GET /api/admin/paas/pricing/app-plans
 * List application pricing plans
 */
router.get('/app-plans', async (req, res) => {
  const plans = await query(
    'SELECT * FROM paas_app_pricing_plans ORDER BY display_order'
  );
  res.json({ plans: plans.rows });
});

/**
 * POST /api/admin/paas/pricing/app-plans
 * Create new application pricing plan
 */
router.post('/app-plans', async (req, res) => {
  const { 
    name, description, billingType, 
    priceMonthly, priceCpuHour, priceRamHour, priceStorageHour, priceNetworkGb,
    maxCpu, maxRam, maxStorage, maxNetwork
  } = req.body;
  
  const result = await query(
    `INSERT INTO paas_app_pricing_plans 
    (name, description, billing_type, price_monthly, 
     price_per_cpu_hour, price_per_gb_ram_hour, price_per_gb_storage_hour, price_per_gb_network,
     max_cpu_cores, max_ram_gb, max_storage_gb, max_network_gb)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [name, description, billingType, priceMonthly, 
     priceCpuHour, priceRamHour, priceStorageHour, priceNetworkGb,
     maxCpu, maxRam, maxStorage, maxNetwork]
  );
  
  res.json({ plan: result.rows[0] });
});

/**
 * GET /api/admin/paas/pricing/addon-plans
 * List database add-on pricing plans
 */
router.get('/addon-plans', async (req, res) => {
  // Implementation
});

/**
 * POST /api/admin/paas/pricing/addon-plans
 * Create add-on pricing plan
 */
router.post('/addon-plans', async (req, res) => {
  // Implementation
```

---

**Client-Facing API Endpoints**

#### [NEW] [api/routes/client/paasApplications.ts](file:///root/skypanelv2/api/routes/client/paasApplications.ts)

Client routes for application lifecycle management - **New user requirement**:

```typescript
import express from 'express';
import { PaaSApplicationService } from '../../services/paasApplicationService.js';
import { query } from '../../lib/database.js';

const router = express.Router();

/**
 * POST /api/paas/applications/:id/start
 * Start a stopped application
 */
router.post('/:id/start', async (req, res) => {
  try {
    const result = await PaaSApplicationService.startApplication({
      applicationId: req.params.id,
      organizationId: req.user.organizationId
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/paas/applications/:id/stop
 * Stop a running application
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const result = await PaaSApplicationService.stopApplication({
      applicationId: req.params.id,
      organizationId: req.user.organizationId
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/paas/applications/:id
 * Delete an application permanently
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await PaaSApplicationService.deleteApplication({
      applicationId: req.params.id,
      organizationId: req.user.organizationId
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/paas/applications/:id/ports
 * Get all port mappings for an application
 */
router.get('/:id/ports', async (req, res) => {
  try {
    const ports = await PaaSApplicationService.getPortMappings(req.params.id);
    res.json({ ports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/paas/applications/:id/ports
 * Add a new port mapping
 */
router.post('/:id/ports', async (req, res) => {
  try {
    const { containerPort, externalPort, protocol, domain, isPrimary, description } = req.body;
    
    const result = await PaaSApplicationService.addPortMapping({
      applicationId: req.params.id,
      organizationId: req.user.organizationId,
      port: { containerPort, externalPort, protocol, domain, isPrimary, description }
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/paas/applications/:id/ports/:portId
 * Update a port mapping
 */
router.patch('/:id/ports/:portId', async (req, res) => {
  try {
    const result = await PaaSApplicationService.updatePortMapping({
      portId: req.params.portId,
      organizationId: req.user.organizationId,
      updates: req.body
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/paas/applications/:id/ports/:portId
 * Remove a port mapping
 */
router.delete('/:id/ports/:portId', async (req, res) => {
  try {
    const result = await PaaSApplicationService.removePortMapping({
      portId: req.params.portId,
      organizationId: req.user.organizationId
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/paas/applications/:id/env
 * Get all environment variables (values masked for security)
 */
router.get('/:id/env', async (req, res) => {
  try {
    const envVars = await PaaSApplicationService.getEnvironmentVariables(req.params.id);
    
    // Mask values for security in list view
    const maskedVars = envVars.map(v => ({
      ...v,
      value: '***MASKED***'
    }));
    
    res.json({ envVars: maskedVars });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/paas/applications/:id/env/:key
 * Set or update an environment variable
 */
router.put('/:id/env/:key', async (req, res) => {
  try {
    const { value, isBuildtime, isRuntime, description } = req.body;
    
    const result = await PaaSApplicationService.setEnvironmentVariable({
      applicationId: req.params.id,
      organizationId: req.user.organizationId,
      envVar: {
        key: req.params.key,
        value,
        isBuildtime: isBuildtime ?? false,
        isRuntime: isRuntime ?? true,
        description
      }
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/paas/applications/:id/env/:key
 * Delete an environment variable
 */
router.delete('/:id/env/:key', async (req, res) => {
  try {
    const result = await PaaSApplicationService.deleteEnvironmentVariable({
      applicationId: req.params.id,
      organizationId: req.user.organizationId,
      key: req.params.key
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

#### [NEW] [api/routes/admin/paasMarketplace.ts](file:///root/skypanelv2/api/routes/admin/paasMarketplace.ts)

Marketplace template management:

```typescript
/**
 * GET /api/admin/paas/marketplace
 * List marketplace templates
 */
router.get('/', async (req, res) => {
  const templates = await query(
    'SELECT * FROM paas_marketplace_templates ORDER BY display_order'
  );
  res.json({ templates: templates.rows });
});

/**
 * POST /api/admin/paas/marketplace
 * Create marketplace template
 */
router.post('/', async (req, res) => {
  const { name, slug, description, iconUrl, category, gitRepository, requiredAddons, pricingPlanId } = req.body;
  
  const result = await query(
    `INSERT INTO paas_marketplace_templates 
    (name, slug, description, icon_url, category, git_repository, required_addons, pricing_plan_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [name, slug, description, iconUrl, category, gitRepository, JSON.stringify(requiredAddons), pricingPlanId]
  );
  
  res.json({ template: result.rows[0] });
});

/**
 * PATCH /api/admin/paas/marketplace/:id
 * Update marketplace template
 */
router.patch('/:id', async (req, res) => {
  // Implementation
});

/**
 * DELETE /api/admin/paas/marketplace/:id
 * Delete marketplace template
 */
router.delete('/:id', async (req, res) => {
  // Implementation
});
```

---

### Frontend Admin Pages

#### [NEW] [src/pages/admin/PaaSWorkerNodes.tsx](file:///root/skypanelv2/src/pages/admin/PaaSWorkerNodes.tsx)

Worker node management page:

**Features**:
- Table listing all workers with status badges
- "Add Worker" button → modal form
- Test Connection action
- Health check indicators
- Decommission action with confirmation

**Form fields** (Add Worker modal):
- Name
- Hostname/IP
- SSH Port (default 22)
- SSH Username
- SSH Private Key (textarea)
- Region (optional)
- Specifications (CPU, RAM, Disk - optional)

---

#### [NEW] [src/pages/admin/PaaSPricing.tsx](file:///root/skypanelv2/src/pages/admin/PaaSPricing.tsx)

Pricing plans management page with tabs:

**Tabs**:
1. **Application Plans**: Manage app pricing (monthly vs per-resource)
2. **Add-on Plans**: Manage database add-on pricing
3. **Marketplace Pricing**: Configure 1-click app pricing

---

#### [NEW] [src/pages/admin/PaaSMarketplace.tsx](file:///root/skypanelv2/src/pages/admin/PaaSMarketplace.tsx)

Marketplace template management:

**Features**:
- List of marketplace templates
- Add/Edit template forms
- Preview template configuration
- Enable/disable templates
- Reorder templates (drag/drop)

---

## Verification Plan

### Automated Tests

1. **Setup Script Tests**
   ```bash
   npm run paas:setup
   npm run paas:check
   ```
   Expected: All dependencies installed and verified

2. **Worker Provisioning Test**
   - Create test worker via admin UI
   - Verify SSH connection
   - Verify uncloud cluster initialization
   - Check database record created

3. **Pricing Plan Tests**
   - Create monthly plan
   - Create per-resource plan
   - Create addon pricing
   - Create marketplace template with pricing

4. **Unit Tests**
   - BuildpackService: Language detection
   - UncloudService: CLI command execution
   - PaaSApplicationService: Lifecycle methods
   - Port management CRUD operations
   - Environment variable encryption/decryption

### End-to-End Browser Testing

**Required**: Full browser testing covering complete user journey

#### Admin Flow Testing
1. **Worker Management** (Browser)
   - Navigate to `/admin/paas/workers`
   - Click "Add Worker" button
   - Fill form with valid SSH credentials
   - Submit and verify worker appears in list
   - Test SSH connection test button
   - Verify worker shows "active" status
   - Test decommission worker

2. **Pricing Configuration** (Browser)
   - Navigate to `/admin/paas/pricing`
   - Create monthly app plan ($10/month, 1 CPU, 1GB RAM)
   - Create per-resource plan ($0.01/CPU-hour, $0.005/GB-RAM-hour)
   - Create PostgreSQL addon plan ($5/month, 10GB)
   - Verify all plans appear correctly

3. **Marketplace Management** (Browser)
   - Navigate to `/admin/paas/marketplace`
   - Add new template (e.g., WordPress)
   - Set Git repository URL
   - Configure required addons
   - Set pricing plan
   - Enable template
   - Verify template appears in client marketplace

#### Client Flow Testing - Complete Deployment Journey

**Test Credentials**:
- URL: `http://localhost:5173`
- Email: `admin@skypanelv2.com`
- Password: `admin123`

1. **User Registration & Login** (Browser)
   - Open browser to `http://localhost:5173`
   - Login with email: `admin@skypanelv2.com`
   - Password: `admin123`
   - Verify login successful
   - Navigate to dashboard

2. **Create PaaS Application** (Browser)
   - Click "Create Application" button
   - Enter application name: `my-test-app`
   - Select pricing plan
   - Provide Git repository URL: `https://github.com/username/nodejs-sample`
   - Click "Create"
   - Verify application appears in list with "inactive" status

3. **Configure Application** (Browser)
   - Click on application to open detail view
   - **Environment Variables Tab**:
     - Click "Add Environment Variable"
     - Add `NODE_ENV=production`
     - Add `PORT=3000`
     - Add `DATABASE_URL=***` (verify value is masked)
     - Save changes
   - **Port Management Tab**:
     - Click "Add Port"
     - Container Port: `3000`
     - Protocol: `https`
     - Mark as primary: `true`
     - Save
     - Verify port appears in list

4. **Deploy Application** (Browser)
   - Click "Deploy" button
   - Verify build logs appear in real-time (WebSocket)
   - Wait for status change: inactive → deploying → running
   - Verify deployment completion message
   - Verify assigned domain shows: `my-test-app.xxxxx.cluster.uncloud.run`

5. **Test Application Access** (Browser)
   - Click on application URL
   - Open in new tab
   - Verify application loads successfully
   - Verify HTTPS certificate is valid
   - Test application functionality

6. **Add Custom Domain** (Browser)
   - Go back to application detail
   - Navigate to "Domains" tab
   - Click "Add Custom Domain"
   - Enter: `myapp.example.com`
   - Copy DNS instructions (CNAME record)
   - Click "Add Domain"
   - Verify DNS setup instructions appear
   - (Manual step: Add CNAME record externally)
   - Click "Restart Application" to apply domain
   - Wait for restart
   - Verify custom domain in domains list

7. **Application Lifecycle** (Browser)
   - **Stop Application**:
     - Click "Stop" button
     - Confirm action
     - Verify status changes to "stopped"
     - Verify application URL returns error
   - **Start Application**:
     - Click "Start" button
     - Verify status changes: stopped → deploying → running
     - Verify application is accessible again
   - **View Logs**:
     - Navigate to "Logs" tab
     - Verify real-time logs streaming
     - Test log filtering
   - **Metrics**:
     - Navigate to "Metrics" tab
     - Verify CPU/RAM usage charts
     - Verify network traffic graphs

8. **Add Database Add-on** (Browser)
   - Navigate to "Add-ons" tab
   - Click "Add Add-on"
   - Select "PostgreSQL"
   - Choose pricing plan
   - Click "Provision"
   - Wait for provisioning
   - Verify connection string appears (masked)
   - Copy connection string
   - Add as environment variable

9. **Deployment History** (Browser)
   - Navigate to "Deployments" tab
   - Verify all deployments listed with:
     - Git commit SHA
     - Timestamp
     - Status (success/failed)
     - Deployed by user
   - Click on deployment to view logs
   - Test rollback to previous deployment

10. **Delete Application** (Browser)
    - Go back to applications list
    - Click "Delete" on test application
    - Confirm deletion (with warning)
    - Verify application removed from list
    - Verify application URL returns 404
    - Verify volumes cleaned up

11. **Marketplace Deployment** (Browser)
    - Navigate to "Marketplace"
    - Find WordPress template
    - Click "Deploy"
    - Configure application name
    - Select pricing plan
    - Auto-provision required add-ons
    - Click "Deploy"
    - Wait for completion
    - Test WordPress installation

12. **Billing Verification** (Browser)
    - Navigate to "Billing" section
    - Verify current usage displayed
    - Check resource consumption graphs
    - View billing history
    - Verify monthly/per-resource charges calculated correctly

### Browser Testing Tools

Use browser automation for E2E tests:

```typescript
// Example: Playwright test for deploy flow
test('Deploy Node.js application', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('[name="email"]', 'admin@skypanelv2.com');
  await page.fill('[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Create application
  await page.click('text=Create Application');
  await page.fill('[name="name"]', 'test-app');
  await page.fill('[name="repositoryUrl"]', 'https://github.com/test/nodejs-app');
  await page.selectOption('[name="pricingPlan"]', 'hobby-plan-id');
  await page.click('button:has-text("Create")');
  
  // Wait for application to appear
  await page.waitForSelector('text=test-app');
  
  // Deploy
  await page.click('text=test-app');
  await page.click('button:has-text("Deploy")');
  
  // Wait for deployment to complete
  await page.waitForSelector('text=running', { timeout: 300000 }); // 5 min
  
  // Verify application accessible
  const appUrl = await page.textContent('[data-testid="app-url"]');
  const appPage = await page.context().newPage();
  await appPage.goto(appUrl);
  await appPage.waitForSelector('text=Hello World');
});
```

### Manual Verification

1. Run `npm run paas:setup` after fresh install
2. Add worker node via admin dashboard
3. Create pricing plans for apps, addons, marketplace
4. **Complete full client flow in browser** (steps 1-12 above)
5. Verify billing calculations
6. Test multi-tenant isolation (deploy apps for 2 different users, verify network isolation)
7. Test security (attempt cross-tenant access)

### Performance Testing

1. **Load Testing**:
   - Deploy 10 applications simultaneously
   - Monitor resource usage on workers
   - Verify all deployments succeed

2. **Concurrent Users**:
   - Simulate 50 concurrent users deploying apps
   - Monitor API response times
   - Verify no race conditions

3. **Network Isolation Testing**:
   - Deploy apps for Tenant A and Tenant B
   - Attempt to access Tenant B's app from Tenant A's container
   - Verify blocked by network isolation

---

## Important Uncloud Command Corrections

**Based on official documentation review**, the following commands must be corrected:

### ✅ Correct Deploy Command
```typescript
// WRONG: uc service deploy
// CORRECT: uc deploy

const command = `uc deploy -f ${composePath} -c ${context}`;
```

### ✅ Correct Port Publishing
```yaml
# Use x-ports extension, NOT standard ports
services:
  app:
    image: myapp:latest
    x-ports:
      - 80/https                      # Auto domain
      - example.com:80/https          # Custom domain
```

### ✅ Service Removal
```typescript
// Remove service
await execAsync(`uc service rm ${serviceName}`);

// IMPORTANT: Volumes not auto-deleted, must manually remove
await execAsync(`uc volume rm ${volumeName}`);
```

### ✅ Add Machine to Cluster
```typescript
// Use uc machine add (not addMachineToCluster)
const command = `uc machine add ${sshUser}@${sshHost} -i ${sshKeyPath} -n ${machineName}`;
```

---

## Timeline Estimate

- Setup Scripts: **1 day**
- Database Schema: **1 day**
- Worker Management: **3 days**
- Pricing System: **2 days**
- Admin UI: **3 days**
- Client UI: **4 days**
- **Browser E2E Testing**: **3 days**
- Security Testing: **1 day**

**Total**: ~18 days

