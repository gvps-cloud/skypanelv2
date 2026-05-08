import React, { lazy, Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { ContactCategoryManager } from "@/components/admin/ContactCategoryManager";
import { ContactMethodManager } from "@/components/admin/ContactMethodManager";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PlatformAvailabilityManager = lazy(
  () => import("@/components/admin/PlatformAvailabilityManager"),
);

interface AdminContactManagementSectionProps {
  token: string;
}

export const AdminContactManagementSection: React.FC<
  AdminContactManagementSectionProps
> = ({ token }) => {
  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-4 sm:p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-3 text-xs sm:text-sm">
            Support
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Contact Management
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Manage contact page content, methods, and availability schedules
          </p>
        </div>

        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <ClipboardList className="absolute right-4 top-4 h-24 w-24 rotate-12 sm:right-10 sm:top-10 sm:h-32 sm:w-32" />
        </div>
      </div>

      <div className="space-y-6">
        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 lg:inline-grid lg:w-auto">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="methods">Contact Methods</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <ContactCategoryManager token={token} />
          </TabsContent>

          <TabsContent value="methods">
            <ContactMethodManager token={token} />
          </TabsContent>

          <TabsContent value="availability">
            <Suspense fallback={<div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>}>
              <PlatformAvailabilityManager />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};
