-- Migration 038: Comprehensive documentation articles
-- Description: Adds detailed documentation for all categories
-- NOTE: Uses ON CONFLICT DO NOTHING to preserve manually edited articles.
--       This migration only seeds on a fresh database.

-- ═══════════════════════════════════════════════════════════════════════
-- GETTING STARTED (category: getting-started)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Welcome to the platform', 'welcome',
'<h2>Welcome to the platform</h2>
<p>the platform is a modern cloud hosting platform built for developers, businesses, and teams. This documentation covers everything you need to deploy, manage, and scale your infrastructure.</p>

<h3>Platform Overview</h3>
<ul>
<li><strong>VPS Hosting</strong> — Deploy virtual private servers with flexible configurations across multiple regions</li>
<li><strong>Billing</strong> — Transparent pay-as-you-go billing with wallet, invoices, and PayPal integration</li>
<li><strong>Organizations</strong> — Team collaboration with role-based access and shared resources</li>
<li><strong>API</strong> — Full REST API for programmatic control of every aspect of your infrastructure</li>
<li><strong>Egress Billing</strong> — Prepaid credit packs for predictable network transfer costs</li>
</ul>

<h3>Quick Start Checklist</h3>
<ol>
<li>Create your account at the registration page</li>
<li>Verify your email address</li>
<li>Add a payment method in Billing</li>
<li>Generate or upload an SSH key</li>
<li>Create your first VPS</li>
<li>Connect via SSH or the web console</li>
</ol>

<h3>Need Help?</h3>
<p>If you run into any issues, check the <strong>FAQ</strong> or open a <strong>support ticket</strong> from the Support page. Our team is available to assist you.</p>',
'Platform overview and quick start guide for new users.', 0, TRUE
FROM documentation_categories WHERE slug = 'getting-started'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Creating Your First VPS', 'creating-your-first-vps',
'<h2>Creating Your First VPS</h2>
<p>Deploy a Virtual Private Server in minutes with the platform. Here is a step-by-step walkthrough.</p>

<h3>Step 1: Navigate to VPS</h3>
<p>Click <strong>Compute</strong> in the sidebar, then click <strong>Create VPS</strong>.</p>

<h3>Step 2: Choose a Plan</h3>
<p>Select a plan based on your resource requirements:</p>
<table>
<thead><tr><th>Tier</th><th>CPU</th><th>RAM</th><th>Storage</th><th>Best For</th></tr></thead>
<tbody>
<tr><td>Starter</td><td>1 vCPU</td><td>1 GB</td><td>25 GB SSD</td><td>Development, small apps</td></tr>
<tr><td>Standard</td><td>2 vCPU</td><td>4 GB</td><td>80 GB SSD</td><td>Web servers, databases</td></tr>
<tr><td>Pro</td><td>4 vCPU</td><td>8 GB</td><td>160 GB SSD</td><td>Production workloads</td></tr>
<tr><td>Enterprise</td><td>8+ vCPU</td><td>16+ GB</td><td>320+ GB SSD</td><td>High-traffic applications</td></tr>
</tbody>
</table>

<h3>Step 3: Select a Region</h3>
<p>Choose a data center closest to your users for the lowest latency. Available regions include multiple locations across North America, Europe, and Asia.</p>

<h3>Step 4: Choose an Image</h3>
<p>Select an operating system. Available images include:</p>
<ul>
<li>Ubuntu 22.04 / 24.04 LTS</li>
<li>Debian 11 / 12</li>
<li>CentOS Stream 9</li>
<li>Alpine Linux</li>
<li>Rocky Linux 9</li>
<li>Fedora</li>
</ul>

<h3>Step 5: Configure</h3>
<ul>
<li><strong>Hostname</strong> — A friendly name for your server</li>
<li><strong>Root Password</strong> — Set a secure root password</li>
<li><strong>SSH Key</strong> — Select an uploaded SSH key for secure access (recommended over password)</li>
<li><strong>StackScript</strong> — Optionally apply a StackScript for automated setup</li>
</ul>

<h3>Step 6: Deploy</h3>
<p>Click <strong>Create</strong>. Your VPS will be provisioned in typically under 60 seconds. You will see the status change from "Provisioning" to "Running".</p>

<h3>After Deployment</h3>
<p>Once your VPS is running, you can:</p>
<ul>
<li>View its IP address on the VPS detail page</li>
<li>Connect via SSH or the web console</li>
<li>Monitor resource usage (CPU, RAM, Disk, Network)</li>
<li>Manage backups, firewalls, and more</li>
</ul>',
'Step-by-step guide to deploying your first virtual server.', 1, TRUE
FROM documentation_categories WHERE slug = 'getting-started'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Web Console (Browser SSH)', 'web-console',
'<h2>Web Console</h2>
<p>The built-in web console lets you access your VPS terminal directly from your browser — no SSH client needed.</p>

<h3>Opening the Console</h3>
<ol>
<li>Navigate to your VPS detail page</li>
<li>Click the <strong>SSH Console</strong> tab</li>
<li>The terminal session opens automatically</li>
</ol>

<h3>Features</h3>
<ul>
<li>Full terminal emulation with Xterm.js</li>
<li>Copy/paste support (Ctrl+C/V or right-click)</li>
<li>Session persistence during page refreshes</li>
<li>Works behind corporate firewalls that block port 22</li>
</ul>

<h3>Limitations</h3>
<ul>
<li>The web console is not a replacement for SSH keys — use SSH keys for automated scripts</li>
<li>Session timeout applies after a period of inactivity</li>
<li>Some advanced terminal features may not be fully supported</li>
</ul>

<h3>Tips</h3>
<ul>
<li>Use the web console for quick checks or when you do not have an SSH client available</li>
<li>For production work, configure SSH key access and use a local terminal</li>
<li>If the console disconnects, refresh the page to reconnect</li>
</ul>',
'Using the browser-based SSH console to access your VPS.', 2, TRUE
FROM documentation_categories WHERE slug = 'getting-started'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- ACCOUNT MANAGEMENT (category: account-management)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Managing SSH Keys', 'ssh-keys',
'<h2>SSH Key Management</h2>
<p>SSH keys provide secure, passwordless authentication to your VPS instances.</p>

<h3>Generating a New Key</h3>
<p>On your local machine, generate an Ed25519 key pair:</p>
<pre><code>ssh-keygen -t ed25519 -C "your_email@example.com"</code></pre>
<p>This creates two files:</p>
<ul>
<li><code>~/.ssh/id_ed25519</code> — Your private key (keep this secret)</li>
<li><code>~/.ssh/id_ed25519.pub</code> — Your public key (add this to the platform)</li>
</ul>

<h3>Adding a Key to the platform</h3>
<ol>
<li>Go to <strong>SSH Keys</strong> in the sidebar</li>
<li>Click <strong>Add SSH Key</strong></li>
<li>Enter a descriptive name (e.g., "MacBook Pro")</li>
<li>Paste the contents of your public key file</li>
<li>Click <strong>Save</strong></li>
</ol>

<h3>Using Your Key</h3>
<p>When creating or rebuilding a VPS, select your SSH key. After deployment:</p>
<pre><code>ssh root@your-server-ip</code></pre>

<h3>Managing Keys</h3>
<ul>
<li><strong>Edit</strong> — Update the key name or public key content</li>
<li><strong>Delete</strong> — Remove a key (this does not remove it from already-deployed VPS instances)</li>
</ul>

<h3>Security Best Practices</h3>
<ul>
<li>Use Ed25519 over RSA (faster, more secure, smaller keys)</li>
<li>Set a passphrase on your private key</li>
<li>Never share your private key</li>
<li>Use one key per device so you can revoke access per-device</li>
<li>Consider using an SSH agent to manage multiple keys</li>
</ul>',
'How to generate, add, and manage SSH keys for secure server access.', 0, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'User Settings & Profile', 'user-settings',
'<h2>User Settings</h2>
<p>Manage your account profile, security settings, and preferences from the Settings page.</p>

<h3>Profile</h3>
<ul>
<li><strong>First Name / Last Name</strong> — Display name used across the platform</li>
<li><strong>Email</strong> — Your login email; changing it requires verification</li>
</ul>

<h3>Security</h3>
<ul>
<li><strong>Change Password</strong> — Set a new account password</li>
<li><strong>Two-Factor Authentication (2FA)</strong> — Enable TOTP-based 2FA for enhanced security</li>
<li><strong>Active Sessions</strong> — View and revoke active login sessions</li>
</ul>

<h3>Notifications</h3>
<p>Configure email notification preferences for:</p>
<ul>
<li>VPS events (creation, deletion, status changes)</li>
<li>Billing alerts (invoice generated, payment received)</li>
<li>Security events (login from new device, password change)</li>
<li>Support ticket updates</li>
</ul>

<h3>API Keys</h3>
<p>Create and manage API keys for programmatic access:</p>
<ol>
<li>Navigate to Settings → API Keys</li>
<li>Click <strong>Create API Key</strong></li>
<li>Give it a name and optional expiry date</li>
<li>Copy the key immediately — it will not be shown again</li>
</ol>

<h3>Account Deletion</h3>
<p>Contact support to request account deletion. All VPS instances, organizations you own, and associated data will be permanently removed.</p>',
'Account settings, security, notifications, and API key management.', 1, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Organization Management', 'organizations',
'<h2>Organizations</h2>
<p>Organizations let teams share VPS instances, billing, and resources with role-based access control.</p>

<h3>Creating an Organization</h3>
<ol>
<li>Go to <strong>Organizations</strong> in the sidebar</li>
<li>Click <strong>Create Organization</strong></li>
<li>Enter a name and description</li>
<li>Click <strong>Create</strong></li>
</ol>

<h3>Roles & Permissions</h3>
<table>
<thead><tr><th>Role</th><th>VPS</th><th>Billing</th><th>Members</th><th>Settings</th></tr></thead>
<tbody>
<tr><td><strong>Owner</strong></td><td>Full access</td><td>Full access</td><td>Invite/remove</td><td>Full access</td></tr>
<tr><td><strong>Admin</strong></td><td>Full access</td><td>View</td><td>Invite</td><td>Limited</td></tr>
<tr><td><strong>Member</strong></td><td>View/manage own</td><td>View</td><td>None</td><td>None</td></tr>
</tbody>
</table>

<h3>Inviting Members</h3>
<ol>
<li>Open your organization → Members tab</li>
<li>Click <strong>Invite Member</strong></li>
<li>Enter the email address</li>
<li>Select a role</li>
<li>The invitee receives an email with an acceptance link</li>
</ol>

<h3>Accepting an Invitation</h3>
<p>If you receive an organization invitation:</p>
<ol>
<li>Click the link in the email</li>
<li>Review the organization details</li>
<li>Click <strong>Accept</strong> or <strong>Decline</strong></li>
</ol>
<p>You can also view pending invitations on your Organizations page.</p>

<h3>Switching Organizations</h3>
<p>If you belong to multiple organizations, use the organization switcher in your profile dropdown to change your active context.</p>

<h3>Leaving an Organization</h3>
<p>Members can leave an organization from the Members tab. Owners cannot leave — they must transfer ownership first or delete the organization.</p>',
'Team collaboration with organizations, roles, and invitations.', 2, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- BILLING & PAYMENTS (category: billing-payments)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Billing Overview', 'billing-overview',
'<h2>Billing Overview</h2>
<p>the platform uses a transparent, pay-as-you-go billing model. You only pay for what you use.</p>

<h3>How Billing Works</h3>
<ul>
<li><strong>Hourly Billing</strong> — VPS plans are billed hourly, up to the monthly cap</li>
<li><strong>Wallet System</strong> — Add funds to your wallet via PayPal; charges deduct automatically</li>
<li><strong>Invoices</strong> — Monthly invoices generated automatically for all charges</li>
<li><strong>Egress Credits</strong> — Prepaid credit packs for network transfer</li>
</ul>

<h3>Wallet</h3>
<p>Your wallet is the central balance for all charges:</p>
<ul>
<li>Add funds via PayPal (minimum amount applies)</li>
<li>VPS hourly charges deduct automatically</li>
<li>View transaction history for all deposits and charges</li>
<li>Low-balance alerts are sent via email</li>
</ul>

<h3>Invoices</h3>
<p>Monthly invoices include:</p>
<ul>
<li>Itemized VPS charges (hours used × hourly rate)</li>
<li>Egress transfer charges</li>
<li>Wallet deposits and deductions</li>
<li>PDF download available</li>
</ul>

<h3>Payment Methods</h3>
<p>the platform accepts PayPal for all payments. Add or update your PayPal account in <strong>Billing → Payment Methods</strong>.</p>

<h3>Refunds</h3>
<p>Refund requests can be submitted through support tickets. Refund eligibility depends on the circumstances and is evaluated on a case-by-case basis.</p>',
'Understanding the billing system, wallet, invoices, and payments.', 0, TRUE
FROM documentation_categories WHERE slug = 'billing-payments'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Egress Credits & Transfer Billing', 'egress-credits',
'<h2>Egress Credits</h2>
<p>Outbound network transfer (egress) is billed separately using a prepaid credit system to prevent unexpected charges.</p>

<h3>How It Works</h3>
<ol>
<li>Purchase an egress credit pack (100 GB, 1 TB, 5 TB, or 10 TB)</li>
<li>Credits are applied to your organization balance</li>
<li>Usage is measured hourly and deducted from your balance</li>
<li>When credits reach zero, your VPS instances may be suspended to prevent overages</li>
</ol>

<h3>Purchasing Credits</h3>
<ol>
<li>Navigate to <strong>Billing → Egress Credits</strong></li>
<li>Choose a credit pack size</li>
<li>Complete payment via PayPal</li>
<li>Credits are applied to your active organization immediately</li>
</ol>

<h3>Monitoring Usage</h3>
<ul>
<li><strong>Organization Level</strong> — View total credit balance and purchase history</li>
<li><strong>VPS Level</strong> — Each VPS shows its individual transfer usage on the Networking tab</li>
<li><strong>Hourly Readings</strong> — Transfer deltas are polled every 60 minutes</li>
</ul>

<h3>Auto-Shutoff</h3>
<p>When your organization egress credit balance reaches zero, the system automatically suspends all VPS instances in that organization to prevent uncontrolled transfer charges. Reactivate by purchasing additional credits.</p>

<h3>Credit Packs</h3>
<table>
<thead><tr><th>Pack</th><th>Transfer</th><th>Best For</th></tr></thead>
<tbody>
<tr><td>Starter</td><td>100 GB</td><td>Small projects, development</td></tr>
<tr><td>Standard</td><td>1 TB</td><td>Web servers, APIs</td></tr>
<tr><td>Professional</td><td>5 TB</td><td>Media serving, data processing</td></tr>
<tr><td>Enterprise</td><td>10 TB</td><td>High-traffic applications</td></tr>
</tbody>
</table>',
'Prepaid credit packs for network transfer billing and monitoring.', 1, TRUE
FROM documentation_categories WHERE slug = 'billing-payments'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Payment Methods & Wallet', 'payments',
'<h2>Payment Methods & Wallet</h2>
<p>the platform uses a wallet-based payment system. Add funds to your wallet, and charges deduct automatically.</p>

<h3>Adding Funds</h3>
<ol>
<li>Go to <strong>Billing</strong></li>
<li>Click <strong>Add Funds</strong></li>
<li>Enter the amount</li>
<li>Complete payment via PayPal</li>
<li>Funds appear in your wallet immediately</li>
</ol>

<h3>Wallet Transactions</h3>
<p>Every transaction is logged in your wallet history:</p>
<ul>
<li><strong>Deposit</strong> — Funds added via PayPal</li>
<li><strong>Charge</strong> — Automatic deduction for VPS usage</li>
<li><strong>Egress</strong> — Network transfer credit purchases</li>
</ul>

<h3>Transaction History</h3>
<p>View the full history on the Billing page. Each transaction shows:</p>
<ul>
<li>Amount and type (credit or debit)</li>
<li>Date and time</li>
<li>Description</li>
<li>Associated resource (VPS ID, invoice ID, etc.)</li>
</ul>

<h3>Low Balance</h3>
<p>When your wallet balance drops below a threshold, you will receive an email notification. Ensure sufficient funds to avoid service interruption.</p>',
'PayPal integration, wallet management, and transaction history.', 2, TRUE
FROM documentation_categories WHERE slug = 'billing-payments'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- VPS GUIDE (category: vps-guide)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Connecting to Your VPS', 'connecting',
'<h2>Connecting to Your VPS</h2>
<p>There are two ways to access your VPS: SSH client or the built-in web console.</p>

<h3>Via SSH Client</h3>
<p>With a password:</p>
<pre><code>ssh root@your-server-ip</code></pre>
<p>With an SSH key:</p>
<pre><code>ssh -i ~/.ssh/id_ed25519 root@your-server-ip</code></pre>
<p>With a custom port:</p>
<pre><code>ssh -p 2222 root@your-server-ip</code></pre>

<h3>Via Web Console</h3>
<ol>
<li>Open your VPS detail page</li>
<li>Click the <strong>SSH Console</strong> tab</li>
<li>A browser-based terminal opens (powered by Xterm.js)</li>
</ol>

<h3>First Connection</h3>
<p>On first SSH login, you may see a host key verification prompt:</p>
<pre><code>The authenticity of host "203.0.113.10" can not be established.
ED25519 key fingerprint is SHA256:abcdef123456...
Are you sure you want to continue connecting (yes/no)?</code></pre>
<p>Type <code>yes</code> to continue. The host key is saved to <code>~/.ssh/known_hosts</code>.</p>

<h3>Troubleshooting</h3>
<table>
<thead><tr><th>Problem</th><th>Solution</th></tr></thead>
<tbody>
<tr><td>Connection refused</td><td>Check VPS is running and firewall allows port 22</td></tr>
<tr><td>Permission denied (publickey)</td><td>Verify your SSH key is assigned to the VPS</td></tr>
<tr><td>Connection timed out</td><td>Check firewall rules, try a different network, or use the web console</td></tr>
<tr><td>Host key changed</td><td>Your VPS was rebuilt; remove the old key from known_hosts</td></tr>
<tr><td>Too many auth failures</td><td>Check you are using the correct key or password</td></tr>
</tbody>
</table>',
'SSH and web console access with troubleshooting tips.', 0, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'VPS Management', 'vps-management',
'<h2>VPS Management</h2>
<p>From the VPS detail page you can monitor, configure, and control your instances.</p>

<h3>Power Controls</h3>
<ul>
<li><strong>Boot</strong> — Start a powered-off VPS</li>
<li><strong>Reboot</strong> — Gracefully restart the VPS (sends ACPI signal)</li>
<li><strong>Shutdown</strong> — Gracefully power off the VPS</li>
<li><strong>Rebuild</strong> — Reinstall the operating system (all data is wiped)</li>
<li><strong>Delete</strong> — Permanently remove the VPS and all associated data</li>
</ul>

<h3>Networking</h3>
<ul>
<li><strong>IP Address</strong> — View the public IPv4 address assigned to your VPS</li>
<li><strong>Reverse DNS</strong> — Configure a PTR record for your IP</li>
<li><strong>Firewalls</strong> — Attach or detach firewall configurations</li>
<li><strong>Transfer Usage</strong> — View inbound/outbound network transfer statistics</li>
</ul>

<h3>Backups</h3>
<ul>
<li><strong>Enable Backups</strong> — Turn on automated daily/weekly backups</li>
<li><strong>Take Snapshot</strong> — Create an on-demand backup</li>
<li><strong>Restore</strong> — Restore from any available backup</li>
<li><strong>Schedule</strong> — Configure backup frequency and retention</li>
</ul>

<h3>Monitoring</h3>
<p>Real-time and historical metrics are available on the VPS detail page:</p>
<ul>
<li><strong>CPU Usage</strong> — Percentage of CPU utilization over time</li>
<li><strong>Memory</strong> — RAM used vs. total</li>
<li><strong>Disk I/O</strong> — Read/write operations and throughput</li>
<li><strong>Network</strong> — Inbound/outbound traffic</li>
<li><strong>Uptime</strong> — Time since last boot</li>
</ul>

<h3>Hostname & Notes</h3>
<p>Set a custom hostname for your VPS and add notes for your own reference. Notes support plain text and are only visible to you.</p>',
'VPS power controls, networking, backups, monitoring, and configuration.', 1, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Rebuilding Your VPS', 'rebuilding',
'<h2>Rebuilding Your VPS</h2>
<p>Reinstalling the operating system on your VPS. <strong>All disk data will be permanently deleted.</strong></p>

<h3>When to Rebuild</h3>
<ul>
<li>Switching to a different operating system</li>
<li>Server has been compromised and needs a clean start</li>
<li>Starting fresh after extensive configuration changes</li>
<li>Testing a new distribution</li>
</ul>

<h3>Steps</h3>
<ol>
<li>Open your VPS detail page</li>
<li>Click <strong>Rebuild</strong> in the actions menu</li>
<li>Select a new operating system image</li>
<li>Set a root password</li>
<li>Optionally select an SSH key</li>
<li>Confirm the rebuild</li>
</ol>

<h3>What Happens</h3>
<ul>
<li>The VPS is shut down</li>
<li>The disk is wiped and reformatted</li>
<li>The new OS image is installed</li>
<li>The VPS boots with the new configuration</li>
<li>Your IP address, firewall rules, and backups are preserved</li>
</ul>

<h3>What is NOT Preserved</h3>
<ul>
<li>All files on the disk</li>
<li>Installed software and configurations</li>
<li>SSH keys stored on the server (your SSH keys from the platform are re-applied)</li>
<li>Database data</li>
<li>Cron jobs and scheduled tasks</li>
</ul>

<h3>Before Rebuilding</h3>
<ol>
<li>Back up any important files</li>
<li>Export database dumps if needed</li>
<li>Note your current configuration (installed packages, settings)</li>
<li>Take a snapshot if you might want to revert</li>
</ol>',
'Reinstall the OS on your VPS. Data is permanently deleted.', 2, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

-- NOTE: Plans & Regions article intentionally omitted.
-- Plan details are managed dynamically via the admin panel and pricing APIs.
-- Do not add a static article for this content.

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Firewalls & Security', 'firewalls',
'<h2>Firewalls & Security</h2>
<p>Protect your VPS with firewall configurations that control inbound and outbound traffic.</p>

<h3>What are Firewalls?</h3>
<p>A firewall is a set of rules that allow or block traffic to your VPS. Each rule specifies:</p>
<ul>
<li><strong>Protocol</strong> — TCP, UDP, or ICMP</li>
<li><strong>Ports</strong> — Single port, range, or all ports</li>
<li><strong>Addresses</strong> — Source IP addresses (IPv4 and IPv6)</li>
<li><strong>Action</strong> — Accept or drop</li>
</ul>

<h3>Default Rules</h3>
<p>Every VPS starts with these default rules:</p>
<ul>
<li><strong>Inbound</strong> — Allow SSH (port 22) from any address</li>
<li><strong>Outbound</strong> — Allow all traffic</li>
</ul>

<h3>Attaching a Firewall</h3>
<ol>
<li>Navigate to your VPS detail page</li>
<li>Go to the <strong>Networking</strong> section</li>
<li>Click <strong>Firewalls</strong></li>
<li>Select a firewall configuration to attach</li>
</ol>

<h3>Common Firewall Rules</h3>
<table>
<thead><tr><th>Service</th><th>Port</th><th>Protocol</th></tr></thead>
<tbody>
<tr><td>SSH</td><td>22</td><td>TCP</td></tr>
<tr><td>HTTP</td><td>80</td><td>TCP</td></tr>
<tr><td>HTTPS</td><td>443</td><td>TCP</td></tr>
<tr><td>MySQL</td><td>3306</td><td>TCP</td></tr>
<tr><td>PostgreSQL</td><td>5432</td><td>TCP</td></tr>
<tr><td>Redis</td><td>6379</td><td>TCP</td></tr>
</tbody>
</table>

<h3>Security Best Practices</h3>
<ul>
<li>Only open ports you actually need</li>
<li>Restrict SSH access to your IP when possible</li>
<li>Use the web console if you lock yourself out</li>
<li>Keep your OS and software up to date</li>
<li>Disable root login and use SSH keys exclusively</li>
</ul>',
'Configuring firewall rules to secure your VPS.', 4, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Backups & Snapshots', 'backups',
'<h2>Backups & Snapshots</h2>
<p>Protect your data with automated backups and on-demand snapshots.</p>

<h3>Enabling Automated Backups</h3>
<ol>
<li>Open your VPS detail page</li>
<li>Navigate to <strong>Backups</strong></li>
<li>Click <strong>Enable Backups</strong></li>
<li>Choose a schedule (daily or weekly)</li>
</ol>
<p>Backup pricing is based on the amount of storage used. You are billed for the backup space, not for the VPS.</p>

<h3>Taking a Snapshot</h3>
<p>Create an on-demand backup at any time:</p>
<ol>
<li>Open your VPS detail page</li>
<li>Click <strong>Take Snapshot</strong></li>
<li>Wait for the snapshot to complete (may take several minutes)</li>
</ol>

<h3>Restoring from a Backup</h3>
<ol>
<li>Open your VPS detail page</li>
<li>Go to <strong>Backups</strong></li>
<li>Find the backup you want to restore</li>
<li>Click <strong>Restore</strong></li>
<li>Confirm — this will replace all current data on the VPS</li>
</ol>

<h3>Backup Retention</h3>
<ul>
<li>Automated backups are retained according to the backup schedule</li>
<li>Manual snapshots are kept until you delete them</li>
<li>Deleting a VPS also deletes all its backups</li>
</ul>

<h3>Best Practices</h3>
<ul>
<li>Enable backups for all production VPS instances</li>
<li>Take a snapshot before making major configuration changes</li>
<li>Test restore procedures regularly</li>
<li>Keep critical data backed up off-server as well (S3, etc.)</li>
</ul>',
'Automated backups and on-demand snapshots for data protection.', 5, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- API REFERENCE (category: api-reference)
-- Only 1 article: API Authentication. The rest is handled by the ApiReference component.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'API Authentication', 'authentication',
'<h2>API Authentication</h2>
<p>The platform API uses Bearer token authentication for protected endpoints.</p>

<h3>Getting a Token</h3>
<p>Authenticate with your email and password:</p>
<pre><code>curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"you@example.com\",
    \"password\": \"your-password\"
  }"</code></pre>
<p>Response:</p>
<pre><code>{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "...", "email": "...", "role": "..." }
}</code></pre>

<h3>Using the Token</h3>
<p>Include the token in the Authorization header:</p>
<pre><code>curl https://your-domain.com/api/vps \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"</code></pre>

<h3>Token Lifecycle</h3>
<ul>
<li>Tokens expire after 7 days</li>
<li>Use the refresh endpoint to get a new token before expiry</li>
<li>Logging out blacklists the token immediately</li>
</ul>

<h3>API Keys</h3>
<p>For long-lived programmatic access, create an API key:</p>
<ol>
<li>Navigate to Settings → API Keys</li>
<li>Click <strong>Create API Key</strong></li>
<li>Name it and optionally set an expiry</li>
<li>Use the key in the <code>Authorization: Bearer</code> header</li>
</ol>

<h3>Error Responses</h3>
<table>
<thead><tr><th>Status</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td>401</td><td>Token is missing, expired, or invalid</td></tr>
<tr><td>403</td><td>Authenticated but lacks permission (e.g., non-admin accessing admin routes)</td></tr>
<tr><td>429</td><td>Rate limit exceeded</td></tr>
</tbody>
</table>',
'How to authenticate with the platform API using tokens and API keys.', 0, TRUE
FROM documentation_categories WHERE slug = 'api-reference'
ON CONFLICT DO NOTHING;

-- Update timestamps
UPDATE documentation_categories SET updated_at = NOW();
