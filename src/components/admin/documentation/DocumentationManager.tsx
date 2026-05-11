import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, FolderOpen } from "lucide-react";
import { AdminHeroCard } from "@/components/admin/AdminHeroCard";
import DocumentationCategoryManager from "./DocumentationCategoryManager";
import DocumentationArticleManager from "./DocumentationArticleManager";

export default function DocumentationManager() {
  const [activeTab, setActiveTab] = useState("categories");

  return (
    <div className="space-y-6">
      <AdminHeroCard
        badge="content.docs"
        badgeIcon={BookOpen}
        title="Documentation Manager"
        description="Create and manage platform documentation pages"
        decorativeIcon={BookOpen}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Articles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <DocumentationCategoryManager />
        </TabsContent>

        <TabsContent value="articles" className="mt-6">
          <DocumentationArticleManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
