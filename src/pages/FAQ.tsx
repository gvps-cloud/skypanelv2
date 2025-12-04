import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, LifeBuoy, Search, AlertCircle } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND_NAME } from "../lib/brand";
import PublicLayout from "@/components/PublicLayout";
import { apiClient } from "@/lib/api";
import type { FAQCategoriesResponse, FAQUpdatesResponse, FAQCategoryWithItems, FAQUpdate } from "@/types/faq";

// Transform API data to match the component's expected format
interface LocalFAQCategory {
  category: string;
  questions: Array<{
    q: string;
    a: string;
  }>;
}

function transformCategories(apiCategories: FAQCategoryWithItems[]): LocalFAQCategory[] {
  return apiCategories.map(cat => ({
    category: cat.name,
    questions: cat.items.map(item => ({
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

const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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

        // Fetch categories and updates in parallel
        const [categoriesResponse, updatesResponse] = await Promise.all([
          apiClient.get<FAQCategoriesResponse>('/faq/categories'),
          apiClient.get<FAQUpdatesResponse>('/faq/updates'),
        ]);

        // Transform and set categories
        const transformedCategories = transformCategories(categoriesResponse.categories);
        setCategories(transformedCategories);
        setUpdates(updatesResponse.updates);
      } catch (err) {
        console.error('Failed to fetch FAQ data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load FAQ content');
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
      .map(category => ({
        ...category,
        questions: category.questions.filter(qa =>
          qa.q.toLowerCase().includes(query) || qa.a.toLowerCase().includes(query)
        ),
      }))
      .filter(category => category.questions.length > 0);
  }, [searchQuery, categories]);

  const totalQuestions = useMemo(
    () => categories.reduce((count, category) => count + category.questions.length, 0),
    [categories]
  );

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="mb-10 space-y-4">
            <div className="space-y-2">
              <Badge variant="outline" className="uppercase tracking-wide">Support</Badge>
              <h1 className="text-3xl font-semibold md:text-4xl">Frequently Asked Questions</h1>
              <p className="text-muted-foreground text-base">
                Find answers to the most common questions about {BRAND_NAME}. Still stuck? Our support team is a message away.
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by keyword or topic"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                <CardDescription className="mt-3 text-xs">
                  {isLoading ? (
                    "Loading FAQ content..."
                  ) : (
                    `Showing ${filteredFaqs.reduce((count, category) => count + category.questions.length, 0)} of ${totalQuestions} answers`
                  )}
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="shadow-sm">
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
            <Alert variant="destructive">
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
            <Card>
              <CardContent className="py-10 text-center">
                <h2 className="text-xl font-medium">No FAQ content available</h2>
                <p className="mt-2 text-sm text-muted-foreground">
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
            <Card>
              <CardContent className="py-10 text-center">
                <h2 className="text-xl font-medium">No results for "{searchQuery}"</h2>
                <p className="mt-2 text-sm text-muted-foreground">
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
              defaultValue={filteredFaqs.length ? [toSlug(filteredFaqs[0].category)] : []}
              className="space-y-4"
            >
              {filteredFaqs.map((category) => (
                <AccordionItem value={toSlug(category.category)} key={category.category} className="border-none">
                  <Card className="shadow-sm">
                    <AccordionTrigger className="px-6 py-5">
                      <div className="flex w-full items-start justify-between gap-4 text-left">
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-semibold">{category.category}</CardTitle>
                          <CardDescription className="text-sm">
                            {category.questions.length} {category.questions.length === 1 ? "question" : "questions"}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">Category</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Separator />
                      <div className="px-6 py-4">
                        <Accordion type="multiple" className="space-y-2">
                          {category.questions.map((qa, index) => (
                            <AccordionItem value={`${toSlug(category.category)}-${index}`} key={qa.q} className="border rounded-lg">
                              <AccordionTrigger className="px-4 py-3 text-left text-base font-medium">
                                {qa.q}
                              </AccordionTrigger>
                              <AccordionContent className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
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

          <Card className="mt-10 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-start justify-between gap-6 px-8 py-8 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-semibold">Still have questions?</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  We're here to help with anything from billing to infrastructure architecture. Reach out and we'll respond within one business day.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/support">Open support ticket</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/contact">Talk to sales</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden space-y-6 lg:block">
          <Card>
            <CardHeader>
              <CardTitle>Need something else?</CardTitle>
              <CardDescription>Direct links to our most-requested support resources.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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

          <Card>
            <CardHeader>
              <CardTitle>Latest updates</CardTitle>
              <CardDescription>Highlights from our release notes and platform announcements.</CardDescription>
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
                updates.map((update, index) => (
                  <div key={update.id}>
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
                      <p className="text-muted-foreground">
                        {update.author ? `Committed by ${update.author}` : update.description}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-4">No updates available at this time.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </PublicLayout>
  );
}
