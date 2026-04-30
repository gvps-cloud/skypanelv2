-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data for email templates
INSERT INTO email_templates (name, subject, html_body, text_body) VALUES
(
  'welcome',
  'Welcome to {{companyName}}',
  '<p>Hi {{displayName}},</p><p>Welcome to {{companyName}}. Your account is ready to go.</p><p>If you did not create this account, please contact support right away.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},\n\nWelcome to {{companyName}}. Your account is ready to go.\n\nIf you did not create this account, please contact support right away.\n\nThanks,\nThe {{companyName}} Team'
),
(
  'invitation',
  'You''ve been invited to join {{organizationName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px;"><div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><h2 style="color: #1f2937; margin-top: 0;">You''ve been invited to join {{organizationName}}</h2><p>Hi there,</p><p><strong>{{inviterName}}</strong> ({{inviterEmail}}) has invited you to join <strong>{{organizationName}}</strong> as a <strong>{{role}}</strong>.</p>{{#if organizationName}}<div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;"><p style="margin: 0; color: #374151;"><strong>Organization:</strong> {{organizationName}}<br><strong>Role:</strong> {{role}}<br><strong>Invited by:</strong> {{inviterName}}</p></div>{{/if}}<p>You have two options:</p><table role="presentation" style="width: 100%; border-collapse: separate; border-spacing: 0 10px; margin: 20px 0;"><tr><td style="text-align: center;"><a href="{{acceptLink}}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Invitation & Accept</a></td></tr><tr><td style="text-align: center;"><a href="{{declineLink}}" style="display: inline-block; background-color: white; color: #6b7280; padding: 12px 24px; text-decoration: none; border: 1px solid #d1d5db; border-radius: 6px; font-weight: 600;">Decline Invitation</a></td></tr></table><p style="color: #6b7280; font-size: 14px;">This invitation will expire on <strong>{{expiresAt}}</strong> (7 days from now).</p><p style="color: #6b7280; font-size: 14px;">If the buttons above don''t work, you can copy and paste these links into your browser:</p><p style="color: #6b7280; font-size: 12px; word-break: break-all;">View Invitation: {{invitationLink}}<br>Decline Directly: {{declineLink}}</p><p style="color: #6b7280; font-size: 14px;">If you didn''t expect this invitation, you can safely ignore this email.</p><p style="margin-top: 30px;">Thanks,<br/><strong>The {{companyName}} Team</strong></p></div></div>',
  'You''ve been invited to join {{organizationName}}\n\nHi there,\n\n{{inviterName}} ({{inviterEmail}}) has invited you to join {{organizationName}} as a {{role}}.\n\nOrganization: {{organizationName}}\nRole: {{role}}\nInvited by: {{inviterName}}\n\nYou have two options:\n\n1. View Invitation & Accept: {{invitationLink}}\n2. Decline Invitation: {{declineLink}}\n\nThis invitation will expire on {{expiresAt}} (7 days from now).\n\nIf the links above don''t work, you can copy and paste them into your browser.\n\nIf you didn''t expect this invitation, you can safely ignore this email.\n\nThanks,\nThe {{companyName}} Team'
),
(
  'login_notification',
  '{{companyName}} login notification',
  '<p>Hi {{displayName}},</p><p>We noticed a successful login to your {{companyName}} account just now.</p><p>If this was not you, we recommend resetting your password immediately.</p><p>Thanks,<br/>The {{companyName}} Team</p>',
  'Hi {{displayName}},\n\nWe noticed a successful login to your {{companyName}} account just now.\n\nIf this was not you, we recommend resetting your password immediately.\n\nThanks,\nThe {{companyName}} Team'
),
(
  'password_reset',
  'Reset your {{companyName}} password',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><p>Hi {{displayName}},</p><p>We received a request to reset your {{companyName}} password.</p><p>Enter this 8-digit reset code on the password reset page:</p><div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;"><p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 0; font-family: ''Courier New'', monospace;">{{token}}</p></div><p>This code will expire in <strong>one hour</strong>.</p><p>Go to <a href="{{resetPageUrl}}" style="color: #0066cc;">{{resetPageUrl}}</a> and enter:</p><ol style="line-height: 1.8;"><li>Your email address: <strong>{{email}}</strong></li><li>The 8-digit code above</li><li>Your new password</li></ol><p style="color: #666; font-size: 14px; margin-top: 30px;">If you did not request this password reset, you can safely ignore this email. Your password will not be changed.</p><p style="margin-top: 30px;">Thanks,<br/><strong>The {{companyName}} Team</strong></p></div>',
  'Hi {{displayName}},\n\nWe received a request to reset your {{companyName}} password.\n\nYour 8-digit reset code (valid for 1 hour):\n\n{{token}}\n\nTo reset your password:\n1. Go to {{resetPageUrl}}\n2. Enter your email address: {{email}}\n3. Enter the 8-digit code above\n4. Choose your new password\n\nIf you did not request this password reset, you can safely ignore this email. Your password will not be changed.\n\nThanks,\nThe {{companyName}} Team'
),
(
  'account_notification',
  '{{companyName}} alert: {{title}}',
  '<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;"><p>Hi {{displayName}},</p><p>You have a new <strong>{{category}}</strong> alert from {{companyName}}.</p><div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 8px 0; font-weight: 700;">{{title}}</p><p style="margin: 0 0 8px 0;">{{message}}</p><p style="margin: 0; color: #4b5563; font-size: 12px;">Event: {{eventType}}</p><p style="margin: 4px 0 0 0; color: #4b5563; font-size: 12px;">Time: {{occurredAt}}</p></div><p style="color: #4b5563; font-size: 14px;">You can manage alert categories in your account settings.</p><p>Thanks,<br/><strong>The {{companyName}} Team</strong></p></div>',
  'Hi {{displayName}},\n\nYou have a new {{category}} alert from {{companyName}}.\n\n{{title}}\n{{message}}\nEvent: {{eventType}}\nTime: {{occurredAt}}\n\nYou can manage alert categories in your account settings.\n\nThanks,\nThe {{companyName}} Team'
),
(
  'contact_form',
  '[Contact Form] {{subject}}',
  '<p><strong>New contact form submission received.</strong></p><ul><li><strong>Name:</strong> {{name}}</li><li><strong>Email:</strong> {{email}}</li><li><strong>Category:</strong> {{category}}</li><li><strong>Subject:</strong> {{subject}}</li><li><strong>Submitted At:</strong> {{submittedAt}}</li></ul><p><strong>Message:</strong></p><p>{{{messageHtml}}}</p>',
  'New contact form submission\n\nName: {{name}}\nEmail: {{email}}\nCategory: {{category}}\nSubject: {{subject}}\nSubmitted At: {{submittedAt}}\n\nMessage:\n{{message}}'
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  updated_at = CURRENT_TIMESTAMP;
