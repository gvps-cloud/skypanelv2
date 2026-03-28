-- Migration 037: Seed default documentation articles
-- Description: Adds starter articles for each documentation category

-- Getting Started articles
INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Welcome to the Platform', 'welcome-to-platform',
'<h2>Welcome!</h2>
<p>the platform is a full-featured VPS hosting and billing platform. This guide will help you get started quickly.</p>
<h3>What You Can Do</h3>
<ul>
<li>Create and manage Virtual Private Servers</li>
<li>Monitor resource usage and billing</li>
<li>Manage SSH keys for secure access</li>
<li>Handle organization memberships and billing</li>
<li>Track network transfer (egress) usage</li>
</ul>
<h3>Quick Start</h3>
<ol>
<li>Create an account or log in</li>
<li>Add a payment method in Billing</li>
<li>Create your first VPS from the dashboard</li>
<li>Connect via SSH using your keys</li>
</ol>',
'Get up and running with the platform in minutes.', 0, TRUE
FROM documentation_categories WHERE slug = 'getting-started'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Creating Your First VPS', 'creating-your-first-vps',
'<h2>Creating Your First VPS</h2>
<p>Follow these steps to create and deploy your first virtual private server.</p>
<h3>Steps</h3>
<ol>
<li>Navigate to <strong>VPS</strong> in the sidebar</li>
<li>Click <strong>Create VPS</strong></li>
<li>Choose a plan (CPU, RAM, Storage)</li>
<li>Select a region closest to your users</li>
<li>Pick an operating system image</li>
<li>Set a hostname and root password</li>
<li>Click <strong>Create</strong> and wait for provisioning</li>
</ol>
<h3>Tips</h3>
<ul>
<li>Start with a smaller plan and scale up as needed</li>
<li>Choose a region near your primary user base for lower latency</li>
<li>Use SSH keys instead of passwords for better security</li>
</ul>',
'Step-by-step guide to deploying your first virtual server.', 1, TRUE
FROM documentation_categories WHERE slug = 'getting-started'
ON CONFLICT DO NOTHING;

-- Account Management articles
INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Managing SSH Keys', 'managing-ssh-keys',
'<h2>SSH Key Management</h2>
<p>SSH keys provide a secure way to connect to your VPS instances without using passwords.</p>
<h3>Adding an SSH Key</h3>
<ol>
<li>Go to <strong>SSH Keys</strong> in the sidebar</li>
<li>Click <strong>Add SSH Key</strong></li>
<li>Give your key a descriptive name</li>
<li>Paste your public key (starts with <code>ssh-rsa</code> or <code>ssh-ed25519</code>)</li>
<li>Click <strong>Save</strong></li>
</ol>
<h3>Generating an SSH Key</h3>
<pre><code>ssh-keygen -t ed25519 -C "your_email@example.com"</code></pre>
<p>Your public key is in <code>~/.ssh/id_ed25519.pub</code>.</p>
<h3>Best Practices</h3>
<ul>
<li>Use Ed25519 keys (more secure and faster than RSA)</li>
<li>Set a passphrase on your private key</li>
<li>Use one key per device for easy revocation</li>
</ul>',
'How to add and manage SSH keys for secure server access.', 0, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Organization Management', 'organization-management',
'<h2>Organization Management</h2>
<p>Organizations let you share VPS resources and billing across a team.</p>
<h3>Creating an Organization</h3>
<ol>
<li>Go to <strong>Organizations</strong> in the sidebar</li>
<li>Click <strong>Create Organization</strong></li>
<li>Enter a name and optional description</li>
<li>Click <strong>Create</strong></li>
</ol>
<h3>Inviting Members</h3>
<ol>
<li>Open your organization</li>
<li>Go to the <strong>Members</strong> tab</li>
<li>Click <strong>Invite Member</strong></li>
<li>Enter their email and select a role</li>
</ol>
<h3>Roles</h3>
<ul>
<li><strong>Owner</strong>: Full control, including billing and member management</li>
<li><strong>Admin</strong>: Can manage VPS instances and members</li>
<li><strong>Member</strong>: Can view and manage VPS instances</li>
</ul>',
'Share resources and billing with your team using organizations.', 1, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

-- Billing & Payments articles
INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Understanding Your Bill', 'understanding-your-bill',
'<h2>Understanding Your Bill</h2>
<p>Your bill includes VPS plan costs and any additional usage charges.</p>
<h3>Plan Costs</h3>
<p>Each VPS has a monthly plan price based on CPU, RAM, and storage. You are billed hourly, up to the monthly cap.</p>
<h3>Egress (Network Transfer)</h3>
<p>Outbound network transfer is metered and billed separately. You can purchase prepaid credit packs to cover usage.</p>
<h3>Invoices</h3>
<ul>
<li>Generated monthly for each billing period</li>
<li>Available in <strong>Billing → Invoices</strong></li>
<li>Downloadable as PDF</li>
</ul>
<h3>Payment Methods</h3>
<p>We accept PayPal for payments. Add a payment method in <strong>Billing → Payment Methods</strong>.</p>',
'How billing works, invoices, and payment methods.', 0, TRUE
FROM documentation_categories WHERE slug = 'billing-payments'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Egress Credits', 'egress-credits',
'<h2>Egress Credits</h2>
<p>Egress credits cover outbound network transfer from your VPS instances.</p>
<h3>How It Works</h3>
<ol>
<li>Purchase a credit pack (100GB, 1TB, 5TB, or 10TB)</li>
<li>Credits are added to your organization balance</li>
<li>Usage is polled every hour and deducted from your balance</li>
<li>When credits run out, VPS instances may be suspended</li>
</ol>
<h3>Purchasing Credits</h3>
<ol>
<li>Go to <strong>Billing → Egress Credits</strong></li>
<li>Choose a pack size</li>
<li>Complete payment via PayPal</li>
<li>Credits are applied immediately</li>
</ol>
<h3>Monitoring Usage</h3>
<p>Check your current balance and usage history in the Egress Credits section. Each VPS shows its individual transfer usage on its detail page.</p>',
'Prepaid credit packs for network transfer billing.', 1, TRUE
FROM documentation_categories WHERE slug = 'billing-payments'
ON CONFLICT DO NOTHING;

-- VPS Guide articles
INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Connecting to Your VPS', 'connecting',
'<h2>Connecting to Your VPS</h2>
<p>There are two ways to connect to your VPS: SSH client or the built-in web console.</p>
<h3>Via SSH Client</h3>
<pre><code>ssh root@your-server-ip</code></pre>
<p>If you use an SSH key:</p>
<pre><code>ssh -i ~/.ssh/id_ed25519 root@your-server-ip</code></pre>
<h3>Via Web Console</h3>
<ol>
<li>Go to your VPS detail page</li>
<li>Click the <strong>SSH Console</strong> tab</li>
<li>A browser-based terminal opens automatically</li>
</ol>
<h3>Troubleshooting</h3>
<ul>
<li><strong>Connection refused</strong>: Check that your VPS is running and the firewall allows port 22</li>
<li><strong>Permission denied</strong>: Verify your SSH key is added to the server</li>
<li><strong>Timeout</strong>: Check your network and the VPS region</li>
</ul>',
'SSH and web console access to your virtual servers.', 0, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Rebuilding Your VPS', 'rebuilding',
'<h2>Rebuilding Your VPS</h2>
<p>Rebuilding reinstalls the operating system on your VPS. All data on the disk will be lost.</p>
<h3>When to Rebuild</h3>
<ul>
<li>You want a fresh start with a different OS</li>
<li>Your server has been compromised</li>
<li>You want to switch distributions</li>
</ul>
<h3>Steps</h3>
<ol>
<li>Go to your VPS detail page</li>
<li>Click <strong>Rebuild</strong></li>
<li>Select a new operating system image</li>
<li>Set a new root password</li>
<li>Confirm the rebuild</li>
</ol>
<h3>Warning</h3>
<p><strong>All data will be permanently deleted.</strong> Back up any important files before rebuilding.</p>
<p>The VPS IP address will remain the same after rebuilding.</p>',
'Reinstall the OS on your VPS instance.', 1, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

-- API Reference articles
INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'API Authentication', 'api-authentication',
'<h2>API Authentication</h2>
<p>All authenticated API requests require a Bearer token in the Authorization header.</p>
<h3>Getting a Token</h3>
<pre><code>POST /api/auth/login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "your-password"
}</code></pre>
<h3>Using the Token</h3>
<pre><code>GET /api/vps
Authorization: Bearer YOUR_TOKEN_HERE</code></pre>
<h3>Token Expiry</h3>
<p>Tokens expire after 7 days. Use the refresh endpoint to get a new token:</p>
<pre><code>POST /api/auth/refresh
Authorization: Bearer YOUR_TOKEN_HERE</code></pre>
<h3>API Keys</h3>
<p>You can also create long-lived API keys in <strong>Settings → API Keys</strong> for programmatic access.</p>',
'How to authenticate with the platform API.', 0, TRUE
FROM documentation_categories WHERE slug = 'api-reference'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'API Endpoints Overview', 'api-endpoints-overview',
'<h2>API Endpoints Overview</h2>
<p>The platform API follows REST conventions. All endpoints are prefixed with <code>/api</code>.</p>
<h3>Core Endpoints</h3>
<table>
<thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
<tbody>
<tr><td>POST</td><td>/api/auth/login</td><td>Authenticate and get a token</td></tr>
<tr><td>POST</td><td>/api/auth/register</td><td>Create a new account</td></tr>
<tr><td>POST</td><td>/api/auth/refresh</td><td>Refresh your token</td></tr>
<tr><td>GET</td><td>/api/vps</td><td>List your VPS instances</td></tr>
<tr><td>POST</td><td>/api/vps</td><td>Create a new VPS</td></tr>
<tr><td>GET</td><td>/api/vps/:id</td><td>Get VPS details</td></tr>
<tr><td>DELETE</td><td>/api/vps/:id</td><td>Delete a VPS</td></tr>
<tr><td>GET</td><td>/api/invoices</td><td>List invoices</td></tr>
<tr><td>GET</td><td>/api/ssh-keys</td><td>List SSH keys</td></tr>
<tr><td>POST</td><td>/api/ssh-keys</td><td>Add an SSH key</td></tr>
<tr><td>GET</td><td>/api/organizations</td><td>List organizations</td></tr>
<tr><td>GET</td><td>/api/support</td><td>List support tickets</td></tr>
<tr><td>POST</td><td>/api/support</td><td>Create a support ticket</td></tr>
<tr><td>GET</td><td>/api/notifications/unread-count</td><td>Get unread notification count</td></tr>
<tr><td>GET</td><td>/api/egress/credits</td><td>Get egress credit balance</td></tr>
</tbody>
</table>
<p>For the full list of endpoints, see the <a href="/api-docs">API Reference</a> page.</p>',
'Reference for all available API endpoints.', 1, TRUE
FROM documentation_categories WHERE slug = 'api-reference'
ON CONFLICT DO NOTHING;

-- Add updated_at trigger for existing rows
UPDATE documentation_categories SET updated_at = NOW() WHERE slug IN ('getting-started', 'account-management', 'billing-payments', 'vps-guide', 'api-reference');
