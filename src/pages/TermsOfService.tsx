import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";

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
    value: "acceptance",
    title: "1. Acceptance of Terms",
    content: (
      <>
        <p>
          By accessing and using {BRAND_NAME} ("Service"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these Terms, do not use the Service.
        </p>
        <p>
          These Terms of Service ("Terms") constitute a legally binding agreement between you and {BRAND_NAME} regarding your use of our cloud platform and related services.
        </p>
      </>
    ),
  },
  {
    value: "service",
    title: "2. Description of Service",
    content: (
      <>
        <p>{BRAND_NAME} provides cloud platform services including but not limited to:</p>
        <ul className="space-y-2 pl-6">
          <li>Service provisioning and lifecycle management for enabled products</li>
          <li>Domain, DNS, certificate, database, application, and scheduling tools where available</li>
          <li>Network configuration and resource management</li>
          <li>Automated backups, snapshots, and disaster recovery workflows</li>
          <li>Usage-based billing and prepaid account balances</li>
          <li>Product-specific billing wallets or balances where enabled</li>
          <li>Organization and team management with custom roles and granular permissions</li>
          <li>Observability dashboards, usage analytics, and audit trails</li>
          <li>Support ticket system with file attachments</li>
          <li>REST API and API key access for programmatic resource management</li>
        </ul>
        <p>We may modify, suspend, or discontinue any aspect of the Service at any time with or without notice.</p>
      </>
    ),
  },
  {
    value: "accounts",
    title: "3. Account Registration and Security",
    content: (
      <>
        <p><strong>3.1 Account creation:</strong> You must provide accurate, complete, and current information when registering. You are responsible for safeguarding your credentials.</p>
        <p><strong>3.2 Account security:</strong> You are accountable for all activity under your account. Notify us immediately of unauthorized use or suspected compromise.</p>
        <p><strong>3.3 Eligibility:</strong> You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service.</p>
      </>
    ),
  },
  {
    value: "billing",
    title: "4. Billing and Payments",
    content: (
      <>
        <p><strong>4.1 Pricing:</strong> All fees are listed in USD unless otherwise stated. Enabled product plans may be billed hourly, monthly, or by another usage interval shown at checkout.</p>
        <p><strong>4.2 Wallet system:</strong> Your account may maintain prepaid wallets or product-specific balances. Services may be suspended if required balances reach zero.</p>
        <p><strong>4.3 Payment methods:</strong> We accept transactions via PayPal. Additional processing fees may apply depending on your bank or provider.</p>
        <p><strong>4.4 Refunds:</strong> Refunds may be issued on a prorated basis for unused services at our discretion. No refunds are provided for partially consumed billing periods. Refund disbursements may be processed via PayPal payouts.</p>
        <p><strong>4.5 Usage overages:</strong> Product-specific usage overages may be billed against prepaid balances or credits where enabled. Unused credits may be converted or refunded according to the applicable product policy.</p>
        <p><strong>4.6 Price changes:</strong> We may adjust pricing with 30 days notice. Continued use after notice constitutes acceptance of the new pricing.</p>
      </>
    ),
  },
  {
    value: "acceptable-use",
    title: "5. Acceptable Use Policy",
    content: (
      <>
        <p>You agree not to use the Service to:</p>
        <ul className="space-y-2 pl-6">
          <li>Violate laws, regulations, or third-party rights</li>
          <li>Distribute malware, ransomware, or other harmful code</li>
          <li>Engage in fraudulent, deceptive, or illegal activity</li>
          <li>Launch DDoS attacks or abuse network resources</li>
          <li>Mine cryptocurrency without written approval</li>
          <li>Send spam or unsolicited bulk communications</li>
          <li>Host, store, or distribute content that infringes copyrights, trademarks, or other intellectual property rights</li>
          <li>Operate phishing sites or pages designed to deceive users into disclosing personal information</li>
          <li>Use email services to send spam, phishing, spoofing, or unsolicited bulk email</li>
          <li>Attempt unauthorized access to other accounts or systems</li>
          <li>Interfere with or disrupt the integrity of the Service</li>
          <li>Overuse shared service resources beyond plan limits in a sustained manner</li>
        </ul>
        <p>Violations may result in immediate suspension or termination without refund.</p>
      </>
    ),
  },
  {
    value: "service-specific-terms",
    title: "6. Service-Specific Terms",
    content: (
      <>
        <p><strong>6.1 Customer content responsibility:</strong> You own and are solely responsible for all content, files, data, and configurations provisioned through the Service. You must ensure that all content complies with applicable laws and these Terms.</p>
        <p><strong>6.2 Domain ownership:</strong> You must own or have lawful control over any domain name added to the Service. You are responsible for domain renewal and DNS record accuracy.</p>
        <p><strong>6.3 Email acceptable use:</strong> Any email capabilities must not be used to send spam, phishing, spoofing, or unsolicited bulk email. We reserve the right to monitor outbound email volume and suspend accounts that violate this policy.</p>
        <p><strong>6.4 Certificates:</strong> Certificate provisioning may be included for eligible domains. You may install custom third-party certificates where supported. Certificate renewal is handled automatically where possible.</p>
        <p><strong>6.5 Resource limits and fair use:</strong> Each product plan may enforce hard resource limits. Shared resources are subject to fair-use policies; sustained overuse may result in throttling or a required plan upgrade.</p>
        <p><strong>6.6 Subscription billing:</strong> Subscription products are billed according to the billing interval shown at checkout. Services may be suspended if required balances reach zero.</p>
        <p><strong>6.7 Data on cancellation:</strong> Upon subscription cancellation, product data may be retained for 30 days and then permanently deleted. You are responsible for exporting all data before cancellation.</p>
        <p><strong>6.8 Third-party control panels:</strong> Some services may be delivered through third-party control panels. While we operate the infrastructure and manage the service, third-party software is provided as-is, and we are not responsible for upstream software defects outside our control.</p>
      </>
    ),
  },
  {
    value: "dmca",
    title: "7. DMCA and Copyright",
    content: (
      <>
        <p><strong>7.1 Copyright policy:</strong> You must not store, publish, or distribute content that infringes the intellectual property rights of others on any {BRAND_NAME} service. This includes customer content, files, databases, and provisioned resources.</p>
        <p><strong>7.2 DMCA takedown notices:</strong> Copyright owners (or their authorized agents) may submit DMCA takedown notices to our designated agent. A valid notice must include:</p>
        <ul className="space-y-2 pl-6">
          <li>A description of the copyrighted work claimed to have been infringed</li>
          <li>Identification of the infringing material and its location on the Service</li>
          <li>The complaining party's contact information (name, address, email, phone)</li>
          <li>A statement of good faith belief that the use is not authorized by the copyright owner, its agent, or the law</li>
          <li>A statement under penalty of perjury that the notice is accurate and that the sender is authorized to act on behalf of the copyright owner</li>
          <li>A physical or electronic signature of the copyright owner or authorized agent</li>
        </ul>
        <p>DMCA notices should be sent to: legal@{BRAND_DOMAIN}</p>
        <p><strong>7.3 Counter-notification:</strong> If you believe your content was wrongly removed, you may submit a counter-notification that includes:</p>
        <ul className="space-y-2 pl-6">
          <li>Identification of the material that was removed and the location where it appeared</li>
          <li>Your name, address, and phone number, and consent to jurisdiction in the federal court in your district</li>
          <li>A statement under penalty of perjury that the material was removed or disabled through mistake or misidentification</li>
          <li>Your physical or electronic signature</li>
        </ul>
        <p>We will restore the content within 10–14 business days of receiving a valid counter-notification unless the original complainant files a court action.</p>
        <p><strong>7.4 Repeat infringer policy:</strong> Accounts with three or more valid DMCA takedown notices may be terminated at our discretion without refund.</p>
      </>
    ),
  },
  {
    value: "sla",
    title: "8. Service Level Agreement (SLA)",
    content: (
      <>
        <p><strong>8.1 Uptime guarantee:</strong> We target 99.9% monthly uptime for core services, excluding scheduled maintenance.</p>
        <p><strong>8.2 Maintenance windows:</strong> We provide at least 48 hours notice before planned maintenance that may impact availability.</p>
        <p><strong>8.3 SLA credits:</strong> If uptime falls below target, you may request service credits as described in our SLA documentation.</p>
      </>
    ),
  },
  {
    value: "privacy",
    title: "9. Data and Privacy",
    content: (
      <>
        <p><strong>9.1 Ownership:</strong> You retain all rights to data stored on the Service, including customer content, files, and databases. We do not claim ownership over your content.</p>
        <p><strong>9.2 Security:</strong> We implement industry-standard controls, but no transmission method is 100% secure. You acknowledge residual risk.</p>
        <p><strong>9.3 Backups:</strong> While we offer backup options, you are ultimately responsible for maintaining independent backups.</p>
        <p><strong>9.4 Privacy policy:</strong> Personal data processing is governed by our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>, incorporated by reference.</p>
      </>
    ),
  },
  {
    value: "ip",
    title: "10. Intellectual Property",
    content: (
      <>
        <p>
          The Service, its original content, features, and functionality are owned by {BRAND_NAME} and protected by applicable intellectual property laws. You may not copy, modify, or redistribute platform assets without written permission.
        </p>
      </>
    ),
  },
  {
    value: "liability",
    title: "11. Limitation of Liability",
    content: (
      <>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {BRAND_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA, OR GOODWILL.
        </p>
        <p>
          Our aggregate liability for claims arising from the Service shall not exceed the fees paid by you in the twelve (12) months preceding the claim.
        </p>
      </>
    ),
  },
  {
    value: "termination",
    title: "12. Termination",
    content: (
      <>
        <p><strong>12.1 By you:</strong> You may terminate your account at any time by contacting support. Eligible prepaid balances may be refunded on a prorated basis.</p>
        <p><strong>12.2 By us:</strong> We may suspend or terminate accounts for policy violations, fraudulent activity, or other reasons at our discretion.</p>
        <p><strong>12.3 After termination:</strong> Access to the Service ceases immediately. We delete customer data within 30 days unless retention is required by law. Product-specific data may be retained for a limited period and then permanently deleted. You must export all data prior to cancellation. Remaining credits may be converted or refunded according to the applicable product policy.</p>
      </>
    ),
  },
  {
    value: "changes",
    title: "13. Changes to Terms",
    content: (
      <>
        <p>
          We may modify these Terms from time to time. Significant changes will be communicated via email or in-app notification. Continued use after updates constitutes acceptance of the revised Terms.
        </p>
      </>
    ),
  },
  {
    value: "law",
    title: "14. Governing Law",
    content: (
      <>
        <p>
          These Terms are governed by the laws of the State of California, United States, without regard to conflict-of-law principles. Disputes shall be resolved in the state or federal courts located in San Francisco County, California.
        </p>
      </>
    ),
  },
  {
    value: "contact",
    title: "15. Contact Information",
    content: (
      <>
        <p>For questions about these Terms, contact our legal team:</p>
        <p>
          Email: legal@{BRAND_DOMAIN}<br />
          Address: 123 Cloud Street, Tech District, San Francisco, CA 94105
        </p>
      </>
    ),
  },
];

export default function TermsOfService() {
  return (
    <div className="container mx-auto max-w-6xl px-4 pb-12 pt-24 font-mono">
      <TerminalPageHeader pathPrefix="~/legal" command="man terms_of_service" className="mb-8" />
      <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="space-y-4">
            <Badge variant="outline" className="uppercase tracking-wide">Legal</Badge>
            <h1 className="text-3xl font-semibold md:text-4xl">Terms of Service</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Last updated {lastUpdated}. These Terms describe your rights and responsibilities when using {BRAND_NAME}. If you have questions, please reach out at any time.
            </p>
          </div>

          <Card className="mt-10 shadow-sm border-primary/25">
            <CardHeader>
              <CardTitle>Agreement overview</CardTitle>
              <CardDescription>Review the sections below or download a copy for your records.</CardDescription>
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
                <h2 className="text-lg font-semibold">Need a signed copy or have compliance questions?</h2>
                <p className="text-sm text-muted-foreground">Our legal and security teams are happy to coordinate NDAs, DPAs, or custom terms for enterprise engagements.</p>
              </div>
              <Button asChild size="lg">
                <Link to="/contact">Contact legal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="shadow-sm border-primary/25">
            <CardHeader>
              <CardTitle>Quick reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <Link to="/privacy" className="font-medium text-primary">Privacy policy</Link>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <a href={`mailto:legal@${BRAND_DOMAIN}`} className="font-medium text-primary">legal@{BRAND_DOMAIN}</a>
              </div>
              <Separator />
              <p>Looking for the previous version of these Terms? Email us and we&apos;ll send a copy.</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-primary/25">
            <CardHeader>
              <CardTitle>Table of contents</CardTitle>
              <CardDescription>Jump to a specific section.</CardDescription>
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
