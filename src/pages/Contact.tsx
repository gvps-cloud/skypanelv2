import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import "@/styles/home.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { BRAND_NAME } from "@/lib/brand";
import type {
  ContactConfig,
  EmailConfig,
  TicketConfig,
  PhoneConfig,
  OfficeConfig,
} from "@/types/contact";

/* ─── Animation Variants ─────────────────────────────────────────── */

const revealContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const revealItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ─── Default Fallback Data ───────────────────────────────────────── */

const DEFAULT_CATEGORIES = [
  {
    id: "1",
    label: "General inquiry",
    value: "general",
    display_order: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "2",
    label: "Pricing & sales",
    value: "sales",
    display_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "3",
    label: "Technical support",
    value: "support",
    display_order: 2,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "4",
    label: "Billing",
    value: "billing",
    display_order: 3,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "5",
    label: "Partnership",
    value: "partnership",
    display_order: 4,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "6",
    label: "Other",
    value: "other",
    display_order: 5,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

const DEFAULT_AVAILABILITY = [
  {
    id: "1",
    day_of_week: "Weekdays",
    is_open: true,
    hours_text: "9:00 AM – 6:00 PM EST",
    display_order: 0,
    created_at: "",
    updated_at: "",
  },
  {
    id: "2",
    day_of_week: "Saturday",
    is_open: true,
    hours_text: "10:00 AM – 4:00 PM EST",
    display_order: 1,
    created_at: "",
    updated_at: "",
  },
  {
    id: "3",
    day_of_week: "Sunday",
    is_open: false,
    hours_text: "Closed",
    display_order: 2,
    created_at: "",
    updated_at: "",
  },
];

const DEFAULT_EMERGENCY_TEXT =
  "Available 24/7 for customers with enterprise SLAs. Call the hotline in your runbook for immediate response.";

/* ─── Trust Items ────────────────────────────────────────────────── */

const trustItems = [
  { icon: Clock, label: "1 hr Avg. Response" },
  { icon: MessageSquare, label: "Real Engineers" },
  { icon: Shield, label: "Enterprise SLA" },
  { icon: Globe, label: "Global Coverage" },
  { icon: Zap, label: "Priority Routing" },
  { icon: Phone, label: "Phone Support" },
  { icon: Mail, label: "Email & Tickets" },
  { icon: MapPin, label: "Headquarters" },
];

/* ─── Component ──────────────────────────────────────────────────── */

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactConfig, setContactConfig] = useState<ContactConfig | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Fetch contact configuration on mount
  useEffect(() => {
    const fetchContactConfig = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/contact/config");

        if (!response.ok) {
          throw new Error("Failed to load contact configuration");
        }

        const data: ContactConfig = await response.json();
        setContactConfig(data);
      } catch (err) {
        console.error("Error fetching contact config:", err);
        // Use default fallback data
        setContactConfig({
          categories: DEFAULT_CATEGORIES,
          methods: {},
          availability: DEFAULT_AVAILABILITY,
          emergency_support_text: DEFAULT_EMERGENCY_TEXT,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchContactConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          category: formData.category,
          message: formData.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errorMessage = data.error || "Failed to send message.";
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          errorMessage = data.errors
            .map((err: { msg?: string }) => err?.msg || "Validation error")
            .join(", ");
        }
        throw new Error(errorMessage);
      }
      toast.success(
        "Message sent successfully! We'll get back to you soon.",
      );
      setFormData({
        name: "",
        email: "",
        subject: "",
        category: "",
        message: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    }
    setIsSubmitting(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Get active categories sorted by display_order
  const categories =
    contactConfig?.categories
      .filter((cat) => cat.is_active)
      .sort((a, b) => a.display_order - b.display_order) ||
    DEFAULT_CATEGORIES;

  // Get active contact methods
  const emailMethod =
    contactConfig?.methods.email?.is_active
      ? contactConfig.methods.email
      : null;
  const ticketMethod =
    contactConfig?.methods.ticket?.is_active
      ? contactConfig.methods.ticket
      : null;
  const phoneMethod =
    contactConfig?.methods.phone?.is_active
      ? contactConfig.methods.phone
      : null;
  const officeMethod =
    contactConfig?.methods.office?.is_active
      ? contactConfig.methods.office
      : null;

  // Get availability schedule
  const availability =
    contactConfig?.availability.sort(
      (a, b) => a.display_order - b.display_order,
    ) || DEFAULT_AVAILABILITY;
  const emergencyText =
    contactConfig?.emergency_support_text || DEFAULT_EMERGENCY_TEXT;

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <MarketingNavbar />
        <main className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">
              Loading contact information...
            </p>
          </div>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main>
        {/* ═══════════════════════════ HERO ═══════════════════════════ */}
        <section className="relative overflow-hidden border-b border-border/40">
          {/* Floating orbs */}
          <div className="home-orb home-orb--1" aria-hidden="true" />
          <div className="home-orb home-orb--2" aria-hidden="true" />
          <div className="home-orb home-orb--3" aria-hidden="true" />
          <div className="home-grid-mask absolute inset-0" aria-hidden="true" />

          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pb-24 lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <Badge
                  variant="outline"
                  className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Contact {BRAND_NAME}
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                  Talk with the{" "}
                  <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                    {BRAND_NAME} team
                  </span>
                </h1>

                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Whether you&apos;re evaluating our platform, planning a migration,
                  or need help with an existing deployment, we respond fast—and
                  with real engineers.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 px-7 home-btn-glow group"
                  asChild
                >
                  <Link to="/support">
                    Open a ticket
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7"
                  asChild
                >
                  <Link to="/contact">Talk to sales</Link>
                </Button>
              </div>

              {/* Quick stats */}
              <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary/70" />
                  1 hr avg. response for priority tickets
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary/70" />
                  Dedicated success engineers
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════ TRUST MARQUEE ═══════════════════════ */}
        <section className="border-b border-border/40 bg-muted/20 py-6">
          <div className="home-marquee">
            <div className="home-marquee__track">
              {[...trustItems, ...trustItems].map((item, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
                >
                  <item.icon className="h-4 w-4 text-primary/60" />
                  <span className="whitespace-nowrap font-medium">
                    {item.label}
                  </span>
                  <span className="ml-4 h-1 w-1 rounded-full bg-border" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ CONTACT CONTENT ══════════════════════════ */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
              {/* Left column — Contact method cards */}
              <motion.div
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="space-y-5"
              >
                <motion.div variants={revealItem}>
                  <Card className="home-feature-card">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                        <Mail className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">
                        {emailMethod?.title || "Email"}
                      </h3>
                      {emailMethod?.description && (
                        <p className="text-sm text-muted-foreground">
                          {emailMethod.description}
                        </p>
                      )}
                      <div className="space-y-2">
                        <a
                          href={`mailto:${(emailMethod?.config as EmailConfig)?.email_address || "support@skypanel.io"}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {(emailMethod?.config as EmailConfig)?.email_address ||
                            "support@skypanel.io"}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {(emailMethod?.config as EmailConfig)?.response_time ||
                            "Response within 24 hours"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={revealItem}>
                  <Card className="home-feature-card">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                        <MessageSquare className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">
                        {ticketMethod?.title || "Support Ticket"}
                      </h3>
                      {ticketMethod?.description && (
                        <p className="text-sm text-muted-foreground">
                          {ticketMethod.description}
                        </p>
                      )}
                      {(ticketMethod?.config as TicketConfig)
                        ?.priority_queues &&
                        (
                          (ticketMethod?.config as TicketConfig)
                            .priority_queues.length > 0
                        ) && (
                        <>
                          <Separator className="my-2" />
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Priority queues
                          </p>
                          <ul className="space-y-2">
                            {(
                              ticketMethod?.config as TicketConfig
                            ).priority_queues.map((queue, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-sm"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                <span className="text-muted-foreground">
                                  {queue.label} ({queue.response_time})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {(ticketMethod?.config as TicketConfig)
                        ?.dashboard_link && (
                        <Button variant="ghost" asChild className="px-0">
                          <Link
                            to={
                              (ticketMethod?.config as TicketConfig)
                                .dashboard_link
                            }
                          >
                            Open dashboard →
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={revealItem}>
                  <Card className="home-feature-card">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                        <Phone className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">
                        {phoneMethod?.title || "Phone"}
                      </h3>
                      {phoneMethod?.description && (
                        <p className="text-sm text-muted-foreground">
                          {phoneMethod.description}
                        </p>
                      )}
                      <div className="space-y-2">
                        <a
                          href={`tel:${(phoneMethod?.config as PhoneConfig)?.phone_number || "+1-800-000-0000"}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {(phoneMethod?.config as PhoneConfig)?.phone_number ||
                            "+1-800-000-0000"}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {(phoneMethod?.config as PhoneConfig)
                            ?.availability_text || "Available during business hours"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={revealItem}>
                  <Card className="home-feature-card">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                        <MapPin className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">
                        {officeMethod?.title || "Office"}
                      </h3>
                      {officeMethod?.description && (
                        <p className="text-sm text-muted-foreground">
                          {officeMethod.description}
                        </p>
                      )}
                      <div className="flex items-start gap-3 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                        <div>
                          {(
                            officeMethod?.config as OfficeConfig
                          )?.address_line1 || "123 Cloud Street"}
                          <br />
                          {(
                            officeMethod?.config as OfficeConfig
                          )?.address_line2 && (
                            <>
                              {
                                (officeMethod?.config as OfficeConfig)
                                  .address_line2
                              }
                              <br />
                            </>
                          )}
                          {(
                            officeMethod?.config as OfficeConfig
                          )?.city ||
                            "San Francisco"}
                          ,{" "}
                          {(officeMethod?.config as OfficeConfig)?.state ||
                            "CA"}{" "}
                          {(officeMethod?.config as OfficeConfig)?.postal_code ||
                            "94105"}
                          <br />
                          {(officeMethod?.config as OfficeConfig)?.country ||
                            "United States"}
                        </div>
                      </div>
                      {(
                        officeMethod?.config as OfficeConfig
                      )?.appointment_required && (
                        <p className="text-xs text-muted-foreground">
                          {(officeMethod?.config as OfficeConfig)?.appointment_required}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Self-serve resources card */}
                <motion.div variants={revealItem}>
                  <Card className="home-gradient-border-top home-glass-panel">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        Self-serve resources
                      </CardTitle>
                      <CardDescription>
                        Instant answers for common requests
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="ghost"
                        asChild
                        className="h-auto w-full justify-start px-0 py-2 text-left"
                      >
                        <Link to="/faq" className="font-medium text-primary">
                          Browse FAQs →
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        asChild
                        className="h-auto w-full justify-start px-0 py-2 text-left"
                      >
                        <Link
                          to="/status"
                          className="font-medium text-primary"
                        >
                          Check platform status →
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        asChild
                        className="h-auto w-full justify-start px-0 py-2 text-left"
                      >
                        <Link
                          to="/api-docs"
                          className="font-medium text-primary"
                        >
                          Review API documentation →
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Right column — Contact form + availability */}
              <motion.div
                variants={revealContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="space-y-6"
              >
                {/* Contact form */}
                <motion.div variants={revealItem}>
                  <Card className="home-gradient-border-top home-animated-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-2xl">Send us a message</CardTitle>
                      <CardDescription>
                        Tell us what you need and we&apos;ll route it to the right
                        specialist.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                              id="name"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              placeholder="John Doe"
                              autoComplete="name"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="john@example.com"
                              autoComplete="email"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="category">Category *</Label>
                            <Select
                              value={formData.category}
                              onValueChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  category: value,
                                }))
                              }
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.value}
                                  >
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="subject">Subject *</Label>
                            <Input
                              id="subject"
                              name="subject"
                              value={formData.subject}
                              onChange={handleChange}
                              placeholder="Brief summary of your request"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message">Message *</Label>
                          <Textarea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            placeholder="Include relevant context—services affected, urgency, or links to dashboards."
                            rows={6}
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          size="lg"
                          className="w-full home-btn-glow"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>Sending…</>
                          ) : (
                            <>
                              Send message
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Availability card */}
                <motion.div variants={revealItem}>
                  <Card className="home-glass-panel">
                    <CardHeader>
                      <CardTitle>Availability</CardTitle>
                      <CardDescription>
                        Standard response windows for each channel
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {availability.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="flex items-center justify-between rounded-lg border border-border/30 bg-gradient-to-b from-background/50 to-muted/10 px-4 py-2.5"
                        >
                          <span className="text-sm text-muted-foreground">
                            {schedule.day_of_week}
                          </span>
                          <span className="text-sm font-medium">
                            {schedule.is_open ? schedule.hours_text : "Closed"}
                          </span>
                        </div>
                      ))}
                      {emergencyText && (
                        <>
                          <Separator className="my-4" />
                          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold text-primary">
                                Emergency support:{" "}
                              </span>
                              {emergencyText}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
