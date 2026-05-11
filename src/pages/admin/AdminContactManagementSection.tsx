import React, { lazy, Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { ContactCategoryManager } from "@/components/admin/ContactCategoryManager";
import { ContactMethodManager } from "@/components/admin/ContactMethodManager";
import { AdminHeroCard } from "@/components/admin/AdminHeroCard";
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
      <AdminHeroCard
        badge="crm.contacts"
        badgeIcon={ClipboardList}
        title="Contact Management"
        description="Manage contact page content, methods, and availability schedules"
        decorativeIcon={ClipboardList}
      />

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
