import { Link } from "react-router-dom";
import { Lock, Shield, ShieldAlert } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BRAND_NAME, BRAND_DOMAIN } from "../lib/brand";
import { TerminalPageHeader } from "@/components/terminal";

const lastUpdated = "May 6, 2026";

const sections = [
  {
    value: "introduction",
    title: "1. Introduction",
    content: (
      <>
        <p>
          {BRAND_NAME} ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our cloud platform.
        </p>
        <p>
          By accessing the Service, you consent to the practices described here. If you disagree with any part of this policy, please discontinue use of the Service.
        </p>
      </>
    ),
  },
  {
    value: "collection",
    title: "2. Information We Collect",
    content: (
      <>
        <p><strong>2.1 Personal information:</strong> When you create an account we collect details such as your name, email address, phone number, timezone, and billing information (processed through PayPal).</p>
        <p><strong>2.2 Technical information:</strong> We gather IP address, device details, operating system, browser type, and logs such as access times and pages viewed. Cookies and similar technologies help us personalize sessions.</p>
        <p><strong>2.3 Usage information:</strong> Resource metrics (CPU, memory, bandwidth), API requests, feature usage patterns, and support interactions help us improve the platform.</p>
        <p><strong>2.4 Customer data:</strong> Content you store or process using the Service remains yours. We access it only to provide the Service or comply with legal obligations.</p>
        <p><strong>2.5 Product data:</strong> Domain names, storage and bandwidth usage, account metadata, database metadata, and subscription details for enabled products.</p>
        <p><strong>2.6 Fraud prevention data:</strong> IP address analysis, VPN/proxy/Tor detection results, and fraud risk scores used for account and transaction screening.</p>
      </>
    ),
  },
  {
    value: "usage",
    title: "3. How We Use Your Information",
    content: (
      <>
        <p>We use collected information to:</p>
        <ul className="space-y-2 pl-6">
          <li>Provide, maintain, and enhance the Service</li>
          <li>Provision and manage enabled product services and related resources</li>
          <li>Process transactions and manage your account</li>
          <li>Send technical notices, security alerts, and administrative messages</li>
          <li>Respond to support requests and improve customer experience</li>
          <li>Monitor usage trends, resource consumption, and enforce plan limits</li>
          <li>Detect and prevent fraud and unauthorized access</li>
          <li>Comply with legal requirements and enforce our Terms of Service</li>
          <li>Send marketing communications with your explicit consent</li>
        </ul>
      </>
    ),
  },
  {
    value: "sharing",
    title: "4. How We Share Information",
    content: (
      <>
        <p>We share data only when necessary:</p>
        <p><strong>4.1 Service providers:</strong> Infrastructure providers, product control panel software providers, payment processors, email delivery services, fraud prevention services, monitoring services, and analytics vendors operate on our behalf under strict data processing agreements.</p>
        <p><strong>4.2 Legal obligations:</strong> We may disclose information to comply with laws, regulations, or lawful requests by public authorities, including DMCA takedown notices.</p>
        <p><strong>4.3 Business transfers:</strong> If we merge, acquire, or sell assets, data may be transferred subject to this policy.</p>
        <p><strong>4.4 With consent:</strong> We share information for other purposes only when you explicitly authorize it.</p>
      </>
    ),
  },
  {
    value: "security",
    title: "5. Data Security",
    content: (
      <>
        <p>We implement technical and organizational safeguards such as:</p>
        <ul className="space-y-2 pl-6">
          <li>TLS encryption for data in transit and encryption for sensitive data at rest</li>
          <li>Product-specific isolation controls where applicable</li>
          <li>Application firewall protections where applicable</li>
          <li>Automated brute force protection and rate limiting on authentication endpoints</li>
          <li>Role-based access controls and multi-factor authentication for internal tools</li>
          <li>Regular penetration tests, vulnerability scanning, and third-party audits</li>
          <li>Security training for employees handling customer data</li>
        </ul>
        <p>Despite these measures, no system is infallible. You acknowledge the inherent risks of transmitting information online.</p>
      </>
    ),
  },
  {
    value: "product-data",
    title: "6. Product Data Processing",
    content: (
      <>
        <p><strong>6.1 Data ownership:</strong> You retain full ownership and control of all content, messages, database data, and files uploaded to the platform.</p>
        <p><strong>6.2 Controller and processor:</strong> {BRAND_NAME} acts as data controller. Infrastructure sub-processors and control panel software providers process customer data solely to deliver the Service under data processing agreements.</p>
        <p><strong>6.3 Data access:</strong> We do not access, read, or analyze customer content, messages, or database data except: (a) to deliver or improve the Service, (b) to comply with legal obligations or court orders, or (c) to investigate suspected abuse or policy violations.</p>
        <p><strong>6.4 Data portability:</strong> You may export product data at any time through available controls or by contacting support.</p>
        <p><strong>6.5 Sub-processors:</strong> A current list of sub-processors is available upon request by contacting privacy@{BRAND_DOMAIN}.</p>
      </>
    ),
  },
  {
    value: "retention",
    title: "7. Data Retention",
    content: (
      <>
        <p>
          We retain personal data for as long as necessary to deliver the Service and fulfill the purposes described in this policy. When you close your account, we delete associated data within 30 days unless retention is required for legal, tax, or accounting reasons.
        </p>
        <p>Product data is retained for the duration of an active subscription and deleted within 30 days after cancellation unless retention is required by law. Activity and audit logs are retained for 12 months. Fraud screening records are retained for 24 months.</p>
      </>
    ),
  },
  {
    value: "rights",
    title: "8. Your Rights and Choices",
    content: (
      <>
        <p>You may exercise the following rights:</p>
        <ul className="space-y-2 pl-6">
          <li><strong>Access:</strong> Request a copy of personal data we hold.</li>
          <li><strong>Correction:</strong> Update inaccurate or incomplete data.</li>
          <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
          <li><strong>Export:</strong> Download product data before account closure.</li>
          <li><strong>Portability:</strong> Receive data in a portable format.</li>
          <li><strong>Opt-out:</strong> Unsubscribe from marketing communications.</li>
          <li><strong>Objection:</strong> Object to certain processing activities.</li>
          <li><strong>Content deletion:</strong> Request immediate removal of specific customer content and receive confirmation.</li>
        </ul>
        <p>Email privacy@{BRAND_DOMAIN} to submit a request. We respond within 30 days.</p>
      </>
    ),
  },
  {
    value: "cookies",
    title: "9. Cookies and Tracking Technologies",
    content: (
      <>
        <p>We use the following categories of cookies and tracking technologies:</p>
        <p><strong>Essential cookies:</strong> Required for session authentication, CSRF protection, and user preferences. These cannot be disabled without losing core functionality.</p>
        <p><strong>Analytics and error tracking:</strong> We use analytics services to understand usage patterns, identify errors, and improve platform performance. This includes page views, device information, and anonymized usage statistics.</p>
        <p><strong>Session replay:</strong> Our analytics provider may record user sessions — including clicks, page navigation, and text input — to help us diagnose issues and improve user experience. Session replay data is encrypted, access-restricted to authorized personnel, and retained for a limited period.</p>
        <p><strong>Preference cookies:</strong> Remember your settings and customizations across sessions.</p>
        <p>You may opt out of analytics, error tracking, and session replay by contacting privacy@{BRAND_DOMAIN} or by configuring your browser to block non-essential cookies. Disabling tracking may affect some platform features.</p>
      </>
    ),
  },
  {
    value: "third-parties",
    title: "10. Third-Party Links",
    content: (
      <>
        <p>Links to external sites or services are provided for convenience. We are not responsible for their privacy practices and encourage you to review the policies of any third party you interact with.</p>
      </>
    ),
  },
  {
    value: "children",
    title: "11. Children's Privacy",
    content: (
      <>
        <p>The Service is not directed at individuals under 18. We do not knowingly collect personal data from children. If you believe a child has provided information, contact us immediately so we can remove it.</p>
      </>
    ),
  },
  {
    value: "transfers",
    title: "12. International Data Transfers",
    content: (
      <>
        <p>Your data may be transferred to and stored in countries where {BRAND_NAME} or its service providers operate. We ensure appropriate safeguards consistent with applicable data protection laws.</p>
      </>
    ),
  },
  {
    value: "changes",
    title: "13. Changes to This Policy",
    content: (
      <>
        <p>We may update this policy periodically. We will post updates on this page and revise the "Last updated" date. Material changes may include email or in-app notice.</p>
      </>
    ),
  },
  {
    value: "contact",
    title: "14. Contact Us",
    content: (
      <>
        <p>Questions or concerns? Reach out to our privacy team:</p>
        <p>
          Email: privacy@{BRAND_DOMAIN}<br />
          Address: 123 Cloud Street, Tech District, San Francisco, CA 94105<br />
          Privacy Officer: privacy@{BRAND_DOMAIN}
        </p>
      </>
    ),
  },
  {
    value: "gdpr",
    title: "15. GDPR Rights (EU/EEA)",
    content: (
      <>
        <p>Residents of the European Economic Area have additional rights, including restriction of processing and the right to lodge complaints with supervisory authorities. We honor these rights in accordance with GDPR.</p>
      </>
    ),
  },
  {
    value: "ccpa",
    title: "16. CCPA Rights (California)",
    content: (
      <>
        <p>California residents may request disclosure of personal information categories we collect, request deletion, and opt out of certain sharing. Submit requests via privacy@{BRAND_DOMAIN}.</p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto max-w-6xl px-4 pb-12 pt-24 font-mono">
      <TerminalPageHeader pathPrefix="~/legal" command="man privacy_policy" className="mb-8" />
      <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="space-y-4">
            <Badge variant="outline" className="uppercase tracking-wide">Privacy</Badge>
            <h1 className="text-3xl font-semibold md:text-4xl">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Last updated {lastUpdated}. This policy explains how {BRAND_NAME} handles personal information, your rights, and how to reach us for additional details.
            </p>
          </div>

          <Card className="mt-10 shadow-sm border-primary/25">
            <CardHeader>
              <CardTitle>How we protect your data</CardTitle>
              <CardDescription>Navigate the sections below for specifics on collection, usage, and rights.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={[sections[0].value]} className="space-y-4">
                {sections.map((section) => (
                  <AccordionItem key={section.value} id={section.value} value={section.value} className="rounded-lg border border-border">
                    <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-5 text-sm leading-6 text-muted-foreground">
                      {section.content}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="mt-8 border-primary/30 bg-primary/5 border-primary/25">
            <CardContent className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Need a data processing addendum (DPA)?</h2>
                <p className="text-sm text-muted-foreground">
                  Enterprise customers can request our standard DPA or submit their own for review. Turnaround typically within three business days.
                </p>
              </div>
              <Button asChild size="lg">
                <Link to="/contact">Request DPA</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="shadow-sm border-primary/25">
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Encryption in transit and at rest
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" /> 24/7 security monitoring
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> SSO and least-privilege access controls
              </div>
              <Separator />
              <p>Want to report a security issue? Email <a href={`mailto:security@${BRAND_DOMAIN}`} className="text-primary">security@{BRAND_DOMAIN}</a>.</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-primary/25">
            <CardHeader>
              <CardTitle>Table of contents</CardTitle>
              <CardDescription>Quickly jump to any section.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <ol className="space-y-3 text-sm">
                  {sections.map((section) => (
                    <li key={section.value}>
                      <a href={`#${section.value}`} className="text-muted-foreground hover:text-primary">
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
