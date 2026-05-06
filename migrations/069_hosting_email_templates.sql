-- Seed default email templates for web hosting lifecycle events
INSERT INTO email_templates (name, subject, html_body, text_body) VALUES
(
  'hosting_credentials',
  'Your {{companyName}} Hosting Panel Access',
  '<p>Hi {{displayName}},</p><p>Your hosting panel account for <strong>{{organizationName}}</strong> is ready.</p><p><strong>Panel URL:</strong> <a href="{{panelUrl}}">{{panelUrl}}</a><br/><strong>Email:</strong> {{to}}<br/><strong>Temporary password:</strong> {{password}}</p><p>Please sign in as soon as possible and change this password. If you cannot find this email later, use the password reset flow on the hosting panel sign-in page.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting panel account for {{organizationName}} is ready.

Panel URL: {{panelUrl}}
Email: {{to}}
Temporary password: {{password}}

Please sign in as soon as possible and change this password. If you cannot find this email later, use the password reset flow on the hosting panel sign-in page.

Thanks,
The {{companyName}} Team'
),
(
  'hosting_welcome',
  'Your {{companyName}} Hosting is Active',
  '<p>Hi {{displayName}},</p><p>Your hosting subscription for <strong>{{domain}}</strong> is now active on the <strong>{{planName}}</strong> plan.</p>{{#if primaryIp}}<p><strong>Primary IP:</strong> {{primaryIp}}</p>{{/if}}<p>You can manage your hosting through the control panel at <a href="{{panelUrl}}">{{panelUrl}}</a>.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting subscription for {{domain}} is now active on the {{planName}} plan.
{{#if primaryIp}}
Primary IP: {{primaryIp}}
{{/if}}
You can manage your hosting through the control panel at {{panelUrl}}.

Thanks,
The {{companyName}} Team'
),
(
  'hosting_suspended',
  'Your {{companyName}} Hosting Has Been Suspended',
  '<p>Hi {{displayName}},</p><p>Your hosting subscription for <strong>{{domain}}</strong> has been suspended.</p><p><strong>Reason:</strong> {{reason}}</p><p>To reactivate your service, please add funds to your hosting wallet and retry billing from your dashboard.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting subscription for {{domain}} has been suspended.

Reason: {{reason}}

To reactivate your service, please add funds to your hosting wallet and retry billing from your dashboard.

Thanks,
The {{companyName}} Team'
),
(
  'hosting_recovered',
  'Your {{companyName}} Hosting Has Been Reactivated',
  '<p>Hi {{displayName}},</p><p>Your hosting subscription for <strong>{{domain}}</strong> has been reactivated and is now fully operational.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting subscription for {{domain}} has been reactivated and is now fully operational.

Thanks,
The {{companyName}} Team'
),
(
  'hosting_cancelled',
  'Your {{companyName}} Hosting Has Been Cancelled',
  '<p>Hi {{displayName}},</p><p>Your hosting subscription for <strong>{{domain}}</strong> has been cancelled.</p>{{#if refundAmount}}<p>A prorated refund of <strong>{{refundAmount}} {{refundCurrency}}</strong> has been credited to your hosting wallet.</p>{{/if}}<p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting subscription for {{domain}} has been cancelled.
{{#if refundAmount}}
A prorated refund of {{refundAmount}} {{refundCurrency}} has been credited to your hosting wallet.
{{/if}}

Thanks,
The {{companyName}} Team'
),
(
  'hosting_renewal',
  '{{companyName}} Hosting Renewal - {{domain}}',
  '<p>Hi {{displayName}},</p><p>Your hosting subscription for <strong>{{domain}}</strong> has been renewed.</p><p><strong>Amount charged:</strong> {{amount}} {{currency}}</p><p><strong>Next billing date:</strong> {{nextBillingDate}}</p>{{#if invoiceId}}<p>Your invoice is available in your account dashboard.</p>{{/if}}<p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting subscription for {{domain}} has been renewed.

Amount charged: {{amount}} {{currency}}
Next billing date: {{nextBillingDate}}
{{#if invoiceId}}
Your invoice is available in your account dashboard.
{{/if}}

Thanks,
The {{companyName}} Team'
),
(
  'hosting_suspension_warning',
  'Action Required: Low Balance for {{domain}}',
  '<p>Hi {{displayName}},</p><p>Your hosting wallet balance is too low to renew <strong>{{domain}}</strong>.</p><p><strong>Current balance:</strong> {{currentBalance}} {{currency}}</p><p><strong>Amount required:</strong> {{requiredAmount}} {{currency}}</p><p><strong>Next billing date:</strong> {{nextBillingDate}}</p><p>Please add funds to avoid service suspension.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting wallet balance is too low to renew {{domain}}.

Current balance: {{currentBalance}} {{currency}}
Amount required: {{requiredAmount}} {{currency}}
Next billing date: {{nextBillingDate}}

Please add funds to avoid service suspension.

Thanks,
The {{companyName}} Team'
),
(
  'hosting_admin_action',
  '{{companyName}} Hosting Update - {{domain}}',
  '<p>Hi {{displayName}},</p><p>Your hosting subscription for <strong>{{domain}}</strong> has been <strong>{{action}}</strong> by an administrator.</p>{{#if reason}}<p><strong>Reason:</strong> {{reason}}</p>{{/if}}<p>If you have questions, please contact support.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},

Your hosting subscription for {{domain}} has been {{action}} by an administrator.
{{#if reason}}
Reason: {{reason}}
{{/if}}

If you have questions, please contact support.

Thanks,
The {{companyName}} Team'
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  updated_at = CURRENT_TIMESTAMP;
