import { count, desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { ProjectCard } from "./project-card";
import { ProjectsPagination } from "./projects-pagination";

const PAGE_SIZE = 10;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getExtracted();
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [userProjects, [{ total }]] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        formatId: projects.formatId,
        sourceLanguage: projects.sourceLanguage,
        targetLanguage: projects.targetLanguage,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.userId, session.user.id))
      .orderBy(desc(projects.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(projects)
      .where(eq(projects.userId, session.user.id)),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-lg font-semibold">{t("Translations")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("Manage your translation projects")}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/projects/new">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("New Project")}
          </Link>
        </Button>
      </div>

      <div className="px-4 lg:px-6">
        {userProjects.length === 0 && page === 1 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground mb-4">
                {t(
                  "No projects yet. Upload a translation file to get started.",
                )}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/projects/new">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("Create your first project")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {userProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
        <ProjectsPagination page={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
