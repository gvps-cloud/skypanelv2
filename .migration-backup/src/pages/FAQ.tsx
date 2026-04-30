import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  LifeBuoy,
  Search,
  AlertCircle,
  Sparkles,
  Shield,
  Zap,
  Globe,
  Users,
  Clock,
  MessageCircle,
  FileText,
} from "lucide-react";

import "@/styles/home.css";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { BRAND_NAME } from "@/lib/brand";
import { apiClient } from "@/lib/api";
import type { FAQCategoriesResponse, FAQUpdatesResponse, FAQCategoryWithItems, FAQUpdate } from "@/types/faq";

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

/* ─── Types ──────────────────────────────────────────────────────── */

interface LocalFAQCategory {
  category: string;
  questions: Array<{
    q: string;
    a: string;
  }>;
}

function transformCategories(apiCategories: FAQCategoryWithItems[]): LocalFAQCategory[] {
  return apiCategories.map((cat) => ({
    category: cat.name,
    questions: cat.items.map((item) => ({
      q: item.question,
      a: item.answer,
    })),
  }));
}

const quickLinks = [
  { label: "Open a support ticket", href: "/support", icon: LifeBuoy },
  { label: "View platform status", href: "/status", icon: ArrowUpRight },
  { label: "Browse API docs", href: "/api-docs", icon: BookOpen },
];

const trustItems = [
  { icon: MessageCircle, label: "24/7 Support" },
  { icon: Clock, label: "Response in 1 Business Day" },
  { icon: Shield, label: "Secure Infrastructure" },
  { icon: Globe, label: "Global Regions" },
  { icon: Zap, label: "Instant Provisioning" },
  { icon: Users, label: "Team Workspaces" },
];

const toSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<LocalFAQCategory[]>([]);
  const [updates, setUpdates] = useState<FAQUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch FAQ data from API
  useEffect(() => {
    const fetchFAQData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [categoriesResponse, updatesResponse] = await Promise.all([
          apiClient.get<FAQCategoriesResponse>("/faq/categories"),
          apiClient.get<FAQUpdatesResponse>("/faq/updates"),
        ]);

        const transformedCategories = transformCategories(categoriesResponse.categories);
        setCategories(transformedCategories);
        setUpdates(updatesResponse.updates);
      } catch (err) {
        console.error("Failed to fetch FAQ data:", err);
        setError(err instanceof Error ? err.message : "Failed to load FAQ content");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFAQData();
  }, []);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return categories;
    }

    return categories
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (qa) =>
            qa.q.toLowerCase().includes(query) ||
            qa.a.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [searchQuery, categories]);

  const totalQuestions = useMemo(
    () => categories.reduce((count, category) => count + category.questions.length, 0),
    [categories]
  );

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

          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="space-y-6"
            >
              <div className="space-y-5">
                <Badge
                  variant="outline"
                  className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Support & Help Center
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                  Frequently Asked
                  <br className="hidden sm:block" />
                  <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                    Questions
                  </span>
                </h1>

                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Find answers to the most common questions about {BRAND_NAME}.{" "}
                  Still stuck? Our support team is just a message away.
                </p>
              </div>

              {/* Search Card */}
              <Card className="home-feature-card border-border/50 bg-card/60 max-w-2xl">
                <CardContent className="pt-5 pb-5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by keyword or topic"
                      className="pl-11 h-11 text-base"
                      disabled={isLoading}
                    />
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    {isLoading ? (
                      "Loading FAQ content..."
                    ) : (
                      <>
                        Showing{" "}
                        <span className="font-medium text-foreground">
                          {filteredFaqs.reduce((count, cat) => count + cat.questions.length, 0)}
                        </span>{" "}
                        of <span className="font-medium text-foreground">{totalQuestions}</span> answers
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════ TRUST MARQUEE ═══════════════════════ */}
        <section className="border-b border-border/40 bg-muted/20 py-5">
          <div className="home-marquee">
            <div className="home-marquee__track">
              {[...trustItems, ...trustItems].map((item, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
                >
                  <item.icon className="h-4 w-4 text-primary/60" />
                  <span className="whitespace-nowrap font-medium">{item.label}</span>
                  <span className="ml-4 h-1 w-1 rounded-full bg-border" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ FAQ CONTENT ═══════════════════════ */}
        <section className="py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
              {/* ── Main Column ── */}
              <div className="space-y-6">
                {/* Loading State */}
                {isLoading && (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="home-feature-card shadow-sm">
                        <CardContent className="p-6 space-y-3">
                          <Skeleton className="h-6 w-1/3" />
                          <Skeleton className="h-4 w-1/4" />
                          <Skeleton className="h-20 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Error State */}
                {!isLoading && error && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error loading FAQ content</AlertTitle>
                    <AlertDescription>
                      {error}. Please try refreshing the page or{" "}
                      <Link to="/support" className="font-medium underline">
                        contact support
                      </Link>{" "}
                      if the problem persists.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Empty State - No FAQ Content */}
                {!isLoading && !error && categories.length === 0 && (
                  <Card className="home-feature-card">
                    <CardContent className="py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
                        <FileText className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <h2 className="text-xl font-medium">No FAQ content available</h2>
                      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                        We're currently updating our FAQ section. In the meantime, please{" "}
                        <Link to="/support" className="font-medium text-primary">
                          contact support
                        </Link>{" "}
                        for any questions you may have.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* No Search Results */}
                {!isLoading && !error && categories.length > 0 && filteredFaqs.length === 0 && (
                  <Card className="home-feature-card">
                    <CardContent className="py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
                        <Search className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h2 className="text-xl font-medium">No results for &ldquo;{searchQuery}&rdquo;</h2>
                      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                        Try adjusting your search or{" "}
                        <Link to="/support" className="font-medium text-primary">
                          contact support
                        </Link>{" "}
                        for personalized help.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* FAQ Content */}
                {!isLoading && !error && filteredFaqs.length > 0 && (
                  <Accordion
                    key={searchQuery}
                    type="multiple"
                    defaultValue={
                      filteredFaqs.length ? [toSlug(filteredFaqs[0].category)] : []
                    }
                    className="space-y-4"
                  >
                    {filteredFaqs.map((category) => (
                      <AccordionItem
                        value={toSlug(category.category)}
                        key={category.category}
                        className="border-none"
                      >
                        <Card className="home-feature-card shadow-sm overflow-hidden">
                          <AccordionTrigger className="px-6 py-5 hover:no-underline">
                            <div className="flex w-full items-start justify-between gap-4 text-left">
                              <div className="space-y-1">
                                <CardTitle className="text-xl font-semibold">
                                  {category.category}
                                </CardTitle>
                                <CardDescription className="text-sm">
                                  {category.questions.length}{" "}
                                  {category.questions.length === 1 ? "question" : "questions"}
                                </CardDescription>
                              </div>
                              <Badge
                                variant="secondary"
                                className="shrink-0 bg-primary/10 text-primary border-primary/20"
                              >
                                Category
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Separator />
                            <div className="px-6 py-4">
                              <Accordion type="multiple" className="space-y-2">
                                {category.questions.map((qa, index) => (
                                  <AccordionItem
                                    value={`${toSlug(category.category)}-${index}`}
                                    key={qa.q}
                                    className="border rounded-lg px-4 py-1 home-faq-item"
                                  >
                                    <AccordionTrigger className="px-3 py-3 text-left text-base font-medium hover:no-underline">
                                      {qa.q}
                                    </AccordionTrigger>
                                    <AccordionContent className="px-3 pb-4 text-sm leading-relaxed text-muted-foreground">
                                      {qa.a}
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            </div>
                          </AccordionContent>
                        </Card>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}

                {/* CTA Card */}
                {!isLoading && !error && filteredFaqs.length > 0 && (
                  <div className="home-cta-shell relative mt-10 overflow-hidden rounded-3xl border border-border/50 px-6 py-14 text-center sm:px-10 shadow-2xl">
                    {/* Floating orbs */}
                    <div
                      className="home-orb absolute w-[280px] h-[280px] -top-[80px] -left-[60px] opacity-35"
                      style={{
                        background:
                          "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)",
                        filter: "blur(60px)",
                        animation: "float-orb-1 16s ease-in-out infinite",
                      }}
                      aria-hidden="true"
                    />
                    <div
                      className="home-orb absolute w-[220px] h-[220px] -bottom-[60px] -right-[40px] opacity-35"
                      style={{
                        background:
                          "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)",
                        filter: "blur(60px)",
                        animation: "float-orb-2 20s ease-in-out infinite",
                      }}
                      aria-hidden="true"
                    />

                    <div className="relative z-10 space-y-4">
                      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Still have questions?
                      </h2>
                      <p className="mx-auto max-w-xl text-base text-muted-foreground">
                        We&rsquo;re here to help with anything from billing to infrastructure
                        architecture. Reach out and we&rsquo;ll respond within one business day.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
                        <Button size="lg" className="h-11 px-7 home-btn-glow" asChild>
                          <Link to="/support">
                            <LifeBuoy className="mr-2 h-4 w-4" />
                            Open support ticket
                          </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-11 px-7" asChild>
                          <Link to="/contact">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Talk to sales
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Sidebar ── */}
              <div className="hidden space-y-6 lg:block">
                {/* Need something else? */}
                <Card className="home-feature-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold">Need something else?</CardTitle>
                    <CardDescription className="text-sm">
                      Direct links to our most-requested support resources.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {quickLinks.map(({ label, href, icon: Icon }) => (
                      <Button
                        key={href}
                        variant="ghost"
                        asChild
                        className="h-auto w-full justify-start px-3 py-3 text-left"
                      >
                        <Link to={href} className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="flex-1 text-sm font-medium">{label}</span>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                {/* Latest updates */}
                <Card className="home-feature-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold">Latest updates</CardTitle>
                    <CardDescription className="text-sm">
                      Highlights from our release notes and platform announcements.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    {isLoading ? (
                      <>
                        <Skeleton className="h-16 w-full" />
                        <Separator />
                        <Skeleton className="h-16 w-full" />
                        <Separator />
                        <Skeleton className="h-16 w-full" />
                      </>
                    ) : updates.length > 0 ? (
                      <motion.div
                        variants={revealContainer}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true }}
                        className="space-y-3"
                      >
                        {updates.map((update, index) => (
                          <motion.div key={update.id} variants={revealItem}>
                            {index > 0 && <Separator className="my-3" />}
                            <div className="group">
                              {update.url ? (
                                <a
                                  href={update.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  {update.title}
                                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                              ) : (
                                <p className="font-medium text-foreground">{update.title}</p>
                              )}
                              <p className="text-muted-foreground mt-0.5">
                                {update.author
                                  ? `Committed by ${update.author}`
                                  : update.description}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    ) : (
                      <p className="py-4 text-center">No updates available at this time.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
