-- Add low_balance email template
INSERT INTO email_templates (name, subject, html_body, text_body) VALUES
(
  'low_balance',
  'Low Balance Alert - {{companyName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><p>Hi {{name}},</p><p>Your account balance is running low (<strong>{{balance}} {{currency}}</strong>).</p><p>You have active services running. To avoid any interruption of service, please log in and top up your balance.</p><p style="margin-top: 30px;">Thanks,<br/><strong>The {{companyName}} Team</strong></p></div>',
  'Hi {{name}},\n\nYour account balance is running low (${{balance}} {{currency}}).\n\nYou have active services running. To avoid any interruption of service, please log in and top up your balance.\n\nThanks,\nThe {{companyName}} Team'
)
ON CONFLICT (name) DO NOTHING;
