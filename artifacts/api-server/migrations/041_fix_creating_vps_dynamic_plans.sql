-- Migration: 041
-- Replace hardcoded plan table in "Creating Your First VPS" article with a marker
-- that the frontend replaces with dynamic plan data from the pricing API.

UPDATE documentation_articles
SET content = '<h2>Creating Your First VPS</h2>
<p>Deploy a Virtual Private Server in minutes with the platform. Here is a step-by-step walkthrough.</p>

<h3>Step 1: Navigate to VPS</h3>
<p>Click <strong>Compute</strong> in the sidebar, then click <strong>Create VPS</strong>.</p>

<h3>Step 2: Choose a Plan</h3>
<p>Select a plan based on your resource requirements:</p>

<!-- VPS_PLANS_TABLE -->

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
</ul>'
WHERE slug = 'creating-your-first-vps';
