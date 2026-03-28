-- Migration 042: Expand platform documentation
-- Description: Adds Support category and 12 new articles across all categories
-- NOTE: Uses ON CONFLICT DO NOTHING to preserve manually edited articles.
--       This migration only seeds on a fresh database.

-- ═══════════════════════════════════════════════════════════════════════
-- NEW CATEGORY: Support
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_categories (name, description, slug, icon, display_order, is_active)
VALUES ('Support', 'Help with support tickets, escalation, and response expectations', 'support', 'Headphones', 5, TRUE)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- ACCOUNT MANAGEMENT: Two-Factor Authentication
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Two-Factor Authentication', 'two-factor-authentication',
'<h2>Two-Factor Authentication</h2>
<p>Two-factor authentication (2FA) adds an extra layer of security to your account. When enabled, you will need both your password and a time-based code from an authenticator app to log in.</p>

<h3>How 2FA Works</h3>
<p>The platform uses TOTP (Time-based One-Time Password), an industry standard supported by all major authenticator apps. Every 30 seconds, your authenticator app generates a new 6-digit code that you enter during login.</p>

<h3>Compatible Authenticator Apps</h3>
<ul>
<li><strong>Google Authenticator</strong> — Available for Android and iOS</li>
<li><strong>Authy</strong> — Available for Android, iOS, and desktop</li>
<li><strong>Microsoft Authenticator</strong> — Available for Android and iOS</li>
<li><strong>1Password</strong> — Built-in TOTP support</li>
<li><strong>Bitwarden</strong> — Built-in TOTP support (premium)</li>
</ul>

<h3>Enabling 2FA</h3>
<ol>
<li>Navigate to <strong>Settings</strong> in the sidebar</li>
<li>Click the <strong>Security</strong> tab</li>
<li>Toggle <strong>Two-Factor Authentication</strong> to enabled</li>
<li>A QR code will appear on screen — scan it with your authenticator app</li>
<li>Enter the 6-digit verification code from your app to confirm setup</li>
</ol>

<div class="border rounded-lg p-4 bg-muted my-4">
<strong>Tip:</strong> If you cannot scan the QR code, click the option to enter the secret key manually. Copy the secret and paste it into your authenticator app.
</div>

<h3>Logging In with 2FA</h3>
<ol>
<li>Enter your email and password as usual</li>
<li>When prompted, open your authenticator app and enter the current 6-digit code</li>
<li>Codes expire after 30 seconds — if your code is rejected, wait for the next one</li>
</ol>

<h3>Disabling 2FA</h3>
<ol>
<li>Navigate to <strong>Settings</strong> → <strong>Security</strong></li>
<li>Toggle <strong>Two-Factor Authentication</strong> to disabled</li>
<li>Enter your account password to confirm</li>
</ol>

<div class="border rounded-lg p-4 bg-destructive/10 my-4">
<strong>Warning:</strong> Disabling 2FA reduces your account security. We strongly recommend keeping 2FA enabled at all times.
</div>

<h3>What If I Lose My Authenticator?</h3>
<p>If you lose access to your authenticator app, contact support to verify your identity and reset your 2FA. You will need to provide proof of account ownership.</p>',
'Learn how to enable, use, and manage two-factor authentication (2FA) for enhanced account security.', 3, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- ACCOUNT MANAGEMENT: API Keys
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'API Keys', 'api-keys',
'<h2>API Keys</h2>
<p>API keys allow you to authenticate requests to the platform API without using your login credentials. They are ideal for automation scripts, CI/CD pipelines, and integrations.</p>

<h3>Creating an API Key</h3>
<ol>
<li>Navigate to <strong>Settings</strong> in the sidebar</li>
<li>Click the <strong>API Keys</strong> tab</li>
<li>Click <strong>Create API Key</strong></li>
<li>Enter a descriptive name for the key (e.g., "CI/CD Pipeline", "Monitoring Script")</li>
<li>Optionally set an expiration date</li>
<li>Click <strong>Create</strong></li>
</ol>

<div class="border rounded-lg p-4 bg-destructive/10 my-4">
<strong>Important:</strong> The full API key is shown <strong>only once</strong> at creation. Copy it immediately and store it securely. You will not be able to see the full key again.
</div>

<h3>Key Format</h3>
<p>API keys follow the format <code>sk_live_</code> followed by a random string. For example:</p>
<pre><code>sk_live_a1b2c3d4e5f6g7h8i9j0...</code></pre>

<h3>Using Your API Key</h3>
<p>Include your API key in requests using one of these methods:</p>

<h4>Method 1: X-API-Key Header</h4>
<pre><code>curl -H "X-API-Key: sk_live_your_key_here" \
  {{PLATFORM_URL}}/api/vps</code></pre>

<h4>Method 2: Bearer Token</h4>
<pre><code>curl -H "Authorization: Bearer sk_live_your_key_here" \
  {{PLATFORM_URL}}/api/vps</code></pre>

<h3>Managing API Keys</h3>
<table>
<tr><th>Action</th><th>Description</th></tr>
<tr><td>View keys</td><td>See all active keys with name, prefix, last used time, and expiration</td></tr>
<tr><td>Revoke a key</td><td>Immediately disables the key — any further requests using it will be rejected</td></tr>
<tr><td>Rename a key</td><td>Update the display name for easier identification</td></tr>
</table>

<h3>Limits</h3>
<ul>
<li>Maximum <strong>10 active keys</strong> per user</li>
<li>Keys can optionally have an expiration date</li>
<li>Revoked keys cannot be reactivated — create a new one instead</li>
</ul>

<h3>Security Best Practices</h3>
<ul>
<li>Never share your API keys in public repositories, chat, or email</li>
<li>Use environment variables to store keys in your scripts</li>
<li>Create separate keys for different purposes (e.g., one for CI/CD, one for monitoring)</li>
<li>Set expiration dates on keys used for temporary purposes</li>
<li>Revoke keys immediately if you suspect they have been compromised</li>
<li>Rotate keys periodically as a precaution</li>
</ul>',
'Create, manage, and secure API keys for programmatic access to the platform.', 4, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- ACCOUNT MANAGEMENT: Activity & Notifications
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Activity & Notifications', 'activity-notifications',
'<h2>Activity & Notifications</h2>
<p>The platform tracks all significant actions on your account and delivers real-time notifications so you stay informed about changes to your infrastructure.</p>

<h3>Notification Bell</h3>
<p>Click the <strong>bell icon</strong> in the top navigation bar to see your latest notifications. The icon shows a badge with the count of unread notifications.</p>

<h3>Notification Types</h3>
<p>The platform sends notifications for the following events:</p>
<table>
<tr><th>Category</th><th>Events</th></tr>
<tr><td>VPS</td><td>Create, boot, shutdown, reboot, delete, rebuild</td></tr>
<tr><td>Backups</td><td>Enable, disable, snapshot taken, restore</td></tr>
<tr><td>Firewall</td><td>Attach, detach rules</td></tr>
<tr><td>Network</td><td>rDNS changes, hostname updates</td></tr>
<tr><td>Billing</td><td>Low balance warnings, payment confirmations</td></tr>
<tr><td>Support</td><td>New ticket replies, status changes</td></tr>
<tr><td>Security</td><td>Login events, API key changes, 2FA changes</td></tr>
<tr><td>Organizations</td><td>Invitations, role changes, member updates</td></tr>
</table>

<h3>Real-Time Updates</h3>
<p>Notifications are delivered in real time using Server-Sent Events (SSE). You do not need to refresh the page — new notifications appear automatically.</p>

<h3>Managing Notifications</h3>
<ul>
<li><strong>Mark as read</strong> — Click a notification to mark it as read</li>
<li><strong>Mark all as read</strong> — Clear all unread notifications at once</li>
<li><strong>View history</strong> — Scroll through past notifications in the dropdown</li>
</ul>

<h3>Organization Invitations</h3>
<p>When you receive an organization invitation, a special notification appears with <strong>Accept</strong> and <strong>Decline</strong> buttons. You can respond directly from the notification without navigating away.</p>

<h3>Activity Feed</h3>
<p>Beyond notifications, the platform maintains a detailed activity log of all actions taken within your organizations. This log is useful for auditing changes and tracking who did what and when.</p>

<h3>Email Notifications</h3>
<p>Critical events such as billing alerts, security changes, and support ticket updates may also trigger email notifications to your registered email address.</p>',
'Understand real-time notifications, activity tracking, and how to stay informed about your account.', 5, TRUE
FROM documentation_categories WHERE slug = 'account-management'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- SUPPORT: Submitting a Support Ticket
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Submitting a Support Ticket', 'submitting-support-ticket',
'<h2>Submitting a Support Ticket</h2>
<p>If you encounter an issue that you cannot resolve through the documentation, you can submit a support ticket to get help from our team.</p>

<h3>Creating a Ticket</h3>
<ol>
<li>Navigate to <strong>Support</strong> in the sidebar</li>
<li>Click <strong>New Ticket</strong></li>
<li>Fill in the following fields:
  <ul>
    <li><strong>Subject</strong> — A brief summary of your issue</li>
    <li><strong>Category</strong> — Select the most relevant category</li>
    <li><strong>Priority</strong> — Choose the appropriate urgency level</li>
    <li><strong>VPS</strong> — Optionally link a specific VPS instance to the ticket</li>
    <li><strong>Message</strong> — Describe your issue in detail</li>
  </ul>
</li>
<li>Click <strong>Submit</strong></li>
</ol>

<h3>Priority Levels</h3>
<table>
<tr><th>Priority</th><th>When to Use</th></tr>
<tr><td>Low</td><td>General questions, feature requests, non-urgent inquiries</td></tr>
<tr><td>Medium</td><td>Configuration help, performance degradation, non-critical issues</td></tr>
<tr><td>High</td><td>Service interruptions, partial outages, billing discrepancies</td></tr>
<tr><td>Urgent</td><td>Complete service outage, data loss risk, security incidents</td></tr>
</table>

<h3>Linking a VPS</h3>
<p>When you link a VPS to your ticket, the system automatically captures the VPS label and IP address at the time of submission. This helps our support team quickly identify and investigate the affected instance.</p>

<h3>Writing an Effective Ticket</h3>
<ul>
<li><strong>Be specific</strong> — Include error messages, IP addresses, timestamps, and steps to reproduce</li>
<li><strong>One issue per ticket</strong> — Submit separate tickets for unrelated problems</li>
<li><strong>Include context</strong> — What were you doing when the issue occurred? What changes did you recently make?</li>
<li><strong>Screenshots</strong> — Attach screenshots of error messages when possible</li>
</ul>

<div class="border rounded-lg p-4 bg-muted my-4">
<strong>Tip:</strong> Before submitting a ticket, check the <strong>FAQ</strong> and <strong>Documentation</strong> — many common questions are already answered there.
</div>

<h3>Permissions</h3>
<p>Access to the support system is controlled by organization roles. You need the <code>tickets_view</code> permission to view tickets and <code>tickets_manage</code> to create and reply to tickets. Contact your organization administrator if you cannot access the support page.</p>',
'Learn how to create effective support tickets with the right category, priority, and details.', 0, TRUE
FROM documentation_categories WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- SUPPORT: Managing Your Tickets
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Managing Your Tickets', 'managing-support-tickets',
'<h2>Managing Your Tickets</h2>
<p>Once you have submitted a support ticket, you can track its progress, communicate with our team, and manage its lifecycle from the Support page.</p>

<h3>Ticket Statuses</h3>
<table>
<tr><th>Status</th><th>Meaning</th></tr>
<tr><td>Open</td><td>Ticket has been submitted and is awaiting a response</td></tr>
<tr><td>In Progress</td><td>A support agent is actively working on your issue</td></tr>
<tr><td>Resolved</td><td>The issue has been addressed — replies will auto-reopen if needed</td></tr>
<tr><td>Closed</td><td>Ticket is closed — requires a reopen request to continue</td></tr>
</table>

<h3>Viewing Tickets</h3>
<p>The Support page displays all your tickets in an inbox-style list. Each ticket shows:</p>
<ul>
<li>Subject and category</li>
<li>Current status with a color-coded indicator</li>
<li>Priority level</li>
<li>Whether a staff member has replied</li>
<li>Last updated time</li>
</ul>

<h3>Replying to a Ticket</h3>
<ol>
<li>Click on a ticket to open it</li>
<li>Type your reply in the message box at the bottom</li>
<li>Click <strong>Send</strong></li>
</ol>
<p>Replies appear in a chat-like conversation view. Staff replies are visually distinguished from your own messages.</p>

<h3>Real-Time Updates</h3>
<p>Ticket updates are delivered in real time. When a support agent replies, the message appears instantly without needing to refresh the page. This is powered by Server-Sent Events (SSE).</p>

<h3>Reopening a Ticket</h3>
<p>If your issue was not fully resolved:</p>
<ul>
<li><strong>Resolved tickets</strong> — Simply reply to the ticket and it will automatically reopen</li>
<li><strong>Closed tickets</strong> — Click <strong>Request Reopen</strong> to submit a reopen request. You can only request reopening once every 5 minutes.</li>
</ul>

<div class="border rounded-lg p-4 bg-muted my-4">
<strong>Tip:</strong> If your original issue has been resolved but you have a new problem, create a new ticket instead of reopening the old one. This keeps conversations focused and easier to track.
</div>

<h3>Staff Replies</h3>
<p>When a support team member replies to your ticket, you will see a staff badge next to their message. Staff replies also trigger a notification to your bell icon so you never miss a response.</p>',
'Track, reply to, and manage your support tickets through their lifecycle.', 1, TRUE
FROM documentation_categories WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- SUPPORT: Escalation & Response Times
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Escalation & Response Times', 'escalation-response-times',
'<h2>Escalation & Response Times</h2>
<p>Our support team aims to respond to all tickets as quickly as possible. Response times vary based on the priority level and complexity of the issue.</p>

<h3>Response Time Targets</h3>
<table>
<tr><th>Priority</th><th>First Response</th><th>Update Frequency</th></tr>
<tr><td>Urgent</td><td>Within 1 hour</td><td>Every 2-4 hours until resolved</td></tr>
<tr><td>High</td><td>Within 4 hours</td><td>Every 8-12 hours</td></tr>
<tr><td>Medium</td><td>Within 12 hours</td><td>Every 24 hours</td></tr>
<tr><td>Low</td><td>Within 24 hours</td><td>As available</td></tr>
</table>

<div class="border rounded-lg p-4 bg-muted my-4">
<strong>Note:</strong> These are target response times, not guarantees. Complex issues may take longer to resolve. We will keep you updated on progress.
</div>

<h3>When to Escalate</h3>
<p>You can increase the priority of a ticket when:</p>
<ul>
<li>The issue has become more severe since initial submission</li>
<li>A non-critical issue is now affecting production services</li>
<li>You have not received a response within the expected timeframe</li>
<li>The issue involves data loss or a security breach</li>
</ul>

<h3>How to Escalate</h3>
<ol>
<li>Open the ticket you want to escalate</li>
<li>Reply with a clear explanation of why the priority should be increased</li>
<li>A support agent will review and update the priority accordingly</li>
</ol>

<h3>What to Include in Urgent Tickets</h3>
<ul>
<li>A clear description of the business impact (e.g., "Our production API is down")</li>
<li>When the issue started (exact time if possible)</li>
<li>What you have already tried to resolve it</li>
<li>Any error messages or logs</li>
<li>Whether the issue affects multiple VPS instances or just one</li>
</ul>

<h3>After-Hours Support</h3>
<p>Support is available during business hours. For urgent issues submitted outside business hours, our on-call team monitors critical tickets and will respond as soon as possible.</p>

<h3>Ticket Etiquette</h3>
<ul>
<li>Avoid submitting duplicate tickets for the same issue</li>
<li>Keep all communication within the ticket — do not email support separately about the same issue</li>
<li>Respond promptly when a support agent asks for additional information</li>
<li>Mark tickets as resolved when your issue is fixed</li>
</ul>',
'Understand response time targets, escalation procedures, and best practices for support tickets.', 2, TRUE
FROM documentation_categories WHERE slug = 'support'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- VPS GUIDE: Monitoring & Metrics
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Monitoring & Metrics', 'monitoring-metrics',
'<h2>Monitoring & Metrics</h2>
<p>Each VPS instance includes built-in monitoring with real-time and historical charts for CPU usage, network traffic, and disk I/O. Access these metrics from the VPS detail page.</p>

<h3>Accessing Metrics</h3>
<ol>
<li>Navigate to <strong>Compute</strong> in the sidebar</li>
<li>Click on a VPS instance to open its detail page</li>
<li>Scroll down to the <strong>Metrics</strong> section</li>
</ol>

<h3>Available Metrics</h3>

<h4>CPU Usage</h4>
<p>Shows CPU utilization as a percentage over time. An area chart displays the trend with summary statistics:</p>
<ul>
<li><strong>Average</strong> — Mean CPU usage across the selected time range</li>
<li><strong>Peak</strong> — Highest CPU usage recorded</li>
<li><strong>Current</strong> — Most recent CPU reading</li>
</ul>

<h4>Network Traffic</h4>
<p>Displays inbound and outbound network traffic in bits per second (bps). Separate charts show:</p>
<ul>
<li><strong>Public inbound/outbound</strong> — Internet-facing traffic</li>
<li><strong>Private inbound/outbound</strong> — Internal network traffic between VPS instances in the same data center</li>
</ul>

<h4>Disk I/O</h4>
<p>Shows disk read and swap operations in blocks per second. Use this to identify disk bottlenecks that may affect application performance.</p>

<h3>Time Ranges</h3>
<p>Use the time range selector to view metrics for different periods. Available options include recent hours and custom date ranges.</p>

<h3>Network Transfer Quota</h3>
<p>The VPS detail page also shows your monthly network transfer quota:</p>
<ul>
<li><strong>Used</strong> — How much transfer you have consumed this billing period</li>
<li><strong>Quota</strong> — Your plan''s included monthly transfer allowance</li>
<li><strong>Billable</strong> — Any overage beyond your quota</li>
</ul>
<p>Transfer usage is displayed as a progress bar for quick visual reference.</p>

<h3>Interpreting Your Metrics</h3>
<table>
<tr><th>Pattern</th><th>Possible Cause</th><th>Action</th></tr>
<tr><td>Sustained high CPU (>80%)</td><td>Application under heavy load</td><td>Consider upgrading your plan or optimizing your application</td></tr>
<tr><td>CPU spikes</td><td>Cron jobs, batch processing</td><td>Normal if periodic — check if it aligns with scheduled tasks</td></tr>
<tr><td>High outbound network</td><td>Serving large files, unexpected traffic</td><td>Monitor egress credits to avoid unexpected charges</td></tr>
<tr><td>High disk I/O</td><td>Database operations, log writing</td><td>Consider optimizing queries or log rotation</td></tr>
<tr><td>No network activity</td><td>Service may be down</td><td>Check if your application is running — try connecting via SSH</td></tr>
</table>',
'Learn how to use CPU, network, and disk I/O charts to monitor your VPS performance.', 5, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- VPS GUIDE: rDNS Configuration
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'rDNS Configuration', 'rdns-configuration',
'<h2>rDNS Configuration</h2>
<p>Reverse DNS (rDNS) maps an IP address back to a domain name. While forward DNS translates a domain to an IP, rDNS does the opposite — it tells other servers what domain name is associated with your IP address.</p>

<h3>Why rDNS Matters</h3>
<ul>
<li><strong>Email delivery</strong> — Many mail servers reject messages from IPs without proper rDNS. If you run a mail server, correct rDNS is essential</li>
<li><strong>Server identification</strong> — rDNS helps identify your server in logs and network tools</li>
<li><strong>Reputation</strong> — Proper rDNS configuration improves your server''s trustworthiness</li>
</ul>

<h3>Automatic rDNS Setup</h3>
<p>When you create a new VPS, the platform automatically configures rDNS in the background. The default format is:</p>
<pre><code>{vps-label}.{base-domain}</code></pre>
<p>For example, if your VPS is named "web-server-1" and the base domain is "ip.rev.example.com", the rDNS would be:</p>
<pre><code>web-server-1.ip.rev.example.com</code></pre>

<h3>Updating rDNS</h3>
<p>You can set a custom rDNS entry for your VPS public IPv4 addresses:</p>
<ol>
<li>Navigate to <strong>Compute</strong> and click on your VPS</li>
<li>Find the <strong>Networking</strong> section</li>
<li>Click the edit icon next to the IP address you want to update</li>
<li>Enter the new rDNS hostname</li>
<li>Click <strong>Save</strong></li>
</ol>

<div class="border rounded-lg p-4 bg-muted my-4">
<strong>Tip:</strong> The rDNS hostname must be a valid domain name that you control. It should have a forward DNS (A record) pointing back to the same IP address for best results.
</div>

<h3>Requirements</h3>
<ul>
<li>Only public IPv4 addresses can have custom rDNS entries</li>
<li>The address must be marked as <code>rdnsEditable</code> in the system</li>
<li>You must be the owner of the VPS (verified through your organization)</li>
<li>rDNS changes are logged in the activity feed</li>
</ul>

<h3>Propagation Time</h3>
<p>rDNS changes may take up to a few minutes to propagate. During this time, lookups may still return the old value. This is normal DNS propagation behavior.</p>

<h3>Troubleshooting rDNS</h3>
<p>To verify your rDNS is working, use the <code>dig</code> or <code>host</code> command from any computer:</p>
<pre><code># Using dig
dig -x YOUR_IP_ADDRESS

# Using host
host YOUR_IP_ADDRESS</code></pre>
<p>The response should show the domain name you configured.</p>',
'Configure reverse DNS for your VPS IP addresses to improve email delivery and server identification.', 6, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- VPS GUIDE: Troubleshooting Guide
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Troubleshooting Guide', 'troubleshooting',
'<h2>Troubleshooting Guide</h2>
<p>This guide covers common issues you may encounter with your VPS and how to resolve them. Before contacting support, try the steps below.</p>

<h3>Cannot Connect via SSH</h3>
<h4>Symptom: Connection refused or timeout</h4>
<ol>
<li><strong>Check VPS status</strong> — Ensure the VPS is running (not shut down or suspended) on the Compute page</li>
<li><strong>Check firewall</strong> — Verify port 22 (SSH) is allowed in your firewall rules</li>
<li><strong>Verify IP address</strong> — Confirm you are connecting to the correct public IP</li>
<li><strong>Try the web console</strong> — Use the browser-based console from the VPS detail page to check if the server itself is responsive</li>
<li><strong>Check SSH service</strong> — Via the web console, run:<br>
<pre><code>sudo systemctl status sshd</code></pre>
If it is not running, start it with:<br>
<pre><code>sudo systemctl start sshd</code></pre>
</li>
</ol>

<h4>Symptom: Permission denied</h4>
<ol>
<li><strong>Check username</strong> — The default username varies by OS (e.g., <code>root</code>, <code>ubuntu</code>, <code>debian</code>)</li>
<li><strong>Check SSH key</strong> — Ensure you have added your SSH key to the platform and it was included during VPS creation</li>
<li><strong>Try password auth</strong> — If enabled, try connecting with your root password via the web console first</li>
</ol>

<h3>VPS Will Not Boot</h3>
<ol>
<li><strong>Check the console</strong> — Open the web console to see boot messages and error output</li>
<li><strong>Try a reboot</strong> — Use the <strong>Reboot</strong> button on the VPS detail page</li>
<li><strong>Check disk space</strong> — A full disk can prevent booting. Via rescue mode or the console, check with <code>df -h</code></li>
<li><strong>Rebuild the VPS</strong> — As a last resort, rebuild the VPS from an image (this erases all data — ensure you have backups)</li>
</ol>

<h3>Slow Performance</h3>
<ol>
<li><strong>Check CPU usage</strong> — View the metrics charts for sustained high CPU. Your application may need optimization or a plan upgrade</li>
<li><strong>Check memory</strong> — Connect via SSH and run:<br>
<pre><code>free -h</code></pre>
If memory is full, identify the process using the most memory:<br>
<pre><code>ps aux --sort=-%mem | head -10</code></pre>
</li>
<li><strong>Check disk I/O</strong> — High disk I/O can slow everything down. Use <code>iostat</code> or check the metrics charts</li>
<li><strong>Check disk space</strong> — A nearly full disk causes performance degradation:<br>
<pre><code>df -h</code></pre>
</li>
</ol>

<h3>Network Issues</h3>
<ol>
<li><strong>Check firewall rules</strong> — Ensure the required ports are open</li>
<li><strong>Test connectivity</strong> — From the web console:<br>
<pre><code>ping 8.8.8.8          # Test basic connectivity
curl -I https://example.com  # Test HTTP
dig example.com        # Test DNS</code></pre>
</li>
<li><strong>Check transfer quota</strong> — If your VPS was auto-suspended due to egress credit exhaustion, add credits and then resume the VPS</li>
</ol>

<h3>Disk Full</h3>
<ol>
<li>Check which directories are using the most space:<br>
<pre><code>du -sh /* | sort -hr | head -10</code></pre>
</li>
<li>Common space consumers:
  <ul>
    <li>Log files — Check <code>/var/log/</code> and set up log rotation</li>
    <li>Docker images — Run <code>docker system prune</code> to clean up</li>
    <li>Temporary files — Check <code>/tmp/</code></li>
  </ul>
</li>
<li>Set up automatic log rotation to prevent recurrence:<br>
<pre><code>sudo apt install logrotate  # Debian/Ubuntu
sudo yum install logrotate   # CentOS/RHEL</code></pre>
</li>
</ol>

<h3>When to Contact Support</h3>
<p>Contact support if:</p>
<ul>
<li>The issue persists after trying the steps above</li>
<li>You see hardware errors in the console</li>
<li>Your VPS is unresponsive through all access methods</li>
<li>You suspect a platform-level issue (e.g., network outage in your region)</li>
</ul>',
'Step-by-step solutions for common VPS issues including SSH problems, boot failures, and slow performance.', 7, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- VPS GUIDE: Security Best Practices
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Security Best Practices', 'security-best-practices',
'<h2>Security Best Practices</h2>
<p>Securing your VPS is your responsibility as the server administrator. Follow these best practices to protect your infrastructure and data.</p>

<h3>1. Use SSH Key Authentication</h3>
<p>SSH keys are far more secure than passwords. They are resistant to brute-force attacks and cannot be guessed.</p>
<ol>
<li><strong>Generate an SSH key</strong> on your local machine:<br>
<pre><code>ssh-keygen -t ed25519 -C "your-email@example.com"</code></pre>
</li>
<li><strong>Add the public key</strong> to the platform in <strong>Settings → SSH Keys</strong></li>
<li><strong>Disable password authentication</strong> on your server. Edit <code>/etc/ssh/sshd_config</code>:<br>
<pre><code>PasswordAuthentication no
ChallengeResponseAuthentication no</code></pre>
Then restart SSH:<br>
<pre><code>sudo systemctl restart sshd</code></pre>
</li>
</ol>

<div class="border rounded-lg p-4 bg-destructive/10 my-4">
<strong>Warning:</strong> Before disabling password authentication, verify your SSH key works. Otherwise you may lock yourself out.
</div>

<h3>2. Configure a Firewall</h3>
<p>Only open the ports you need. Use the platform''s built-in firewall feature or configure one on the server:</p>
<pre><code># Example: Allow SSH and HTTP only (using ufw)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable</code></pre>

<h3>3. Keep Your System Updated</h3>
<p>Regularly update your operating system to patch security vulnerabilities:</p>
<pre><code># Debian/Ubuntu
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y</code></pre>
<p>Consider enabling automatic security updates for critical patches.</p>

<h3>4. Enable Two-Factor Authentication</h3>
<p>Protect your platform account with 2FA. See the <a href="/docs/account-management/two-factor-authentication">Two-Factor Authentication</a> guide for setup instructions.</p>

<h3>5. Use the Principle of Least Privilege</h3>
<ul>
<li>Do not run applications as <code>root</code> — create a dedicated user for each service</li>
<li>Use <code>sudo</code> for administrative tasks instead of logging in as root</li>
<li>Restrict file permissions to only what is needed</li>
<li>In organizations, assign the minimum role that allows each member to do their job</li>
</ul>

<h3>6. Secure API Keys</h3>
<ul>
<li>Never commit API keys to version control (use <code>.gitignore</code> and environment variables)</li>
<li>Use <code>.env</code> files for local development (never commit them)</li>
<li>Set expiration dates on keys used for temporary purposes</li>
<li>Revoke keys immediately if compromised</li>
</ul>

<h3>7. Monitor Your Server</h3>
<ul>
<li>Check the <strong>Metrics</strong> tab regularly for unusual activity</li>
<li>Set up log monitoring for authentication failures:<br>
<pre><code>sudo grep "Failed password" /var/log/auth.log</code></pre>
</li>
<li>Use <code>last</code> and <code>who</code> to see recent and current logins</li>
</ul>

<h3>8. Regular Backups</h3>
<p>Enable the backup service for your VPS to ensure you can recover from data loss. See the <a href="/docs/vps-guide/backups-snapshots">Backups & Snapshots</a> guide for details.</p>

<h3>9. Change the Default SSH Port (Optional)</h3>
<p>Changing the SSH port from 22 to a non-standard port reduces automated scans and brute-force attempts:</p>
<pre><code># Edit /etc/ssh/sshd_config
Port 2222</code></pre>
<p>Remember to update your firewall rules and the SSH connection settings in your client.</p>',
'Essential security practices for protecting your VPS, including SSH hardening, firewalls, and access control.', 8, TRUE
FROM documentation_categories WHERE slug = 'vps-guide'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- BILLING & PAYMENTS: Egress Usage Monitoring
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Egress Usage Monitoring', 'egress-usage-monitoring',
'<h2>Egress Usage Monitoring</h2>
<p>Egress (outbound network transfer) is billed separately from VPS hosting using a prepaid credit system. This article explains how to monitor your usage, understand your balance, and avoid service interruptions.</p>

<h3>How Egress Billing Works</h3>
<ol>
<li>You purchase egress credit packs (e.g., 100 GB, 1 TB, 5 TB, 10 TB)</li>
<li>The system polls your VPS transfer usage every hour</li>
<li>Used transfer is deducted from your credit balance</li>
<li>If credits reach zero, affected VPS instances are automatically suspended</li>
</ol>

<h3>Checking Your Egress Balance</h3>
<ol>
<li>Navigate to <strong>Billing</strong> in the sidebar</li>
<li>Find the <strong>Egress Credits</strong> section</li>
<li>View your current credit balance and recent usage</li>
</ol>

<h3>Usage Monitoring</h3>
<p>The platform tracks network transfer for each VPS instance:</p>
<ul>
<li><strong>Hourly readings</strong> — Transfer usage is polled every 60 minutes from the infrastructure provider</li>
<li><strong>Per-VPS breakdown</strong> — See which VPS instances are consuming the most transfer</li>
<li><strong>Organization totals</strong> — All members in your organization share the same credit pool</li>
</ul>

<h3>Credit Packs</h3>
<table>
<tr><th>Pack Size</th><th>Best For</th></tr>
<tr><td>100 GB</td><td>Small websites, low-traffic applications</td></tr>
<tr><td>1 TB</td><td>Medium-traffic sites, API servers</td></tr>
<tr><td>5 TB</td><td>High-traffic applications, media serving</td></tr>
<tr><td>10 TB</td><td>Large-scale deployments, streaming services</td></tr>
</table>

<h3>Purchasing Credits</h3>
<ol>
<li>Navigate to <strong>Billing</strong> → <strong>Egress Credits</strong></li>
<li>Click <strong>Purchase Credits</strong></li>
<li>Select a credit pack size</li>
<li>Complete payment via PayPal</li>
<li>Credits are added to your organization immediately after payment</li>
</ol>

<h3>Auto-Suspend Protection</h3>
<p>When your egress credits reach zero:</p>
<ol>
<li>VPS instances with outbound transfer are automatically suspended</li>
<li>You will receive a notification about the suspension</li>
<li>To resume, purchase additional credits and then manually resume each VPS</li>
</ol>

<div class="border rounded-lg p-4 bg-destructive/10 my-4">
<strong>Important:</strong> Auto-suspension is a protective measure to prevent unexpected overage charges. Monitor your credit balance regularly and set up low-balance alerts.
</div>

<h3>Tips for Managing Egress Costs</h3>
<ul>
<li><strong>Use a CDN</strong> — Offload static assets (images, CSS, JS) to a CDN to reduce origin transfer</li>
<li><strong>Enable compression</strong> — Configure gzip or Brotli compression on your web server</li>
<li><strong>Optimize images</strong> — Compress images before serving them</li>
<li><strong>Cache aggressively</strong> — Set appropriate cache headers to reduce repeat downloads</li>
<li><strong>Monitor trends</strong> — Track daily usage to predict when you need to purchase more credits</li>
</ul>',
'Monitor egress transfer usage, manage prepaid credits, and prevent auto-suspension of your VPS instances.', 3, TRUE
FROM documentation_categories WHERE slug = 'billing-payments'
ON CONFLICT DO NOTHING;
