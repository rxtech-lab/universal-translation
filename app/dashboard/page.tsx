import { desc, eq } from "drizzle-orm";
import {
  BarChartIcon,
  CheckCircleIcon,
  FolderIcon,
  GlobeIcon,
  LoaderIcon,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { TranslationProject } from "@/lib/translation/types";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      formatId: projects.formatId,
      sourceLanguage: projects.sourceLanguage,
      targetLanguage: projects.targetLanguage,
      status: projects.status,
      content: projects.content,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, session.user.id))
    .orderBy(desc(projects.updatedAt));

  const totalProjects = userProjects.length;
  const inProgressCount = userProjects.filter(
    (p) => p.status === "translating",
  ).length;
  const completedCount = userProjects.filter(
    (p) => p.status === "completed",
  ).length;
  const recentProjects = userProjects.slice(0, 5);

  let totalEntries = 0;
  let translatedEntries = 0;
  for (const project of userProjects) {
    const content = project.content as TranslationProject | null;
    if (content?.resources) {
      for (const resource of content.resources) {
        for (const entry of resource.entries) {
          totalEntries++;
          if (entry.targetText && entry.targetText.trim() !== "") {
            translatedEntries++;
          }
        }
      }
    }
  }
  const progressPercent =
    totalEntries > 0 ? Math.round((translatedEntries / totalEntries) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of your translation projects
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/projects/new">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Project
          </Link>
        </Button>
      </div>

      {totalProjects === 0 ? (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <GlobeIcon className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium mb-1">No projects yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Upload a translation file to get started.
              </p>
              <Button asChild size="sm">
                <Link href="/dashboard/projects/new">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create your first project
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4 lg:px-6">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Total Projects</CardTitle>
                <CardAction>
                  <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalProjects}</div>
                <p className="text-muted-foreground text-xs">projects</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>In Progress</CardTitle>
                <CardAction>
                  <LoaderIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProgressCount}</div>
                <p className="text-muted-foreground text-xs">translating</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Completed</CardTitle>
                <CardAction>
                  <CheckCircleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedCount}</div>
                <p className="text-muted-foreground text-xs">finished</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardAction>
                  <BarChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{progressPercent}%</div>
                <p className="text-muted-foreground text-xs">
                  {translatedEntries} of {totalEntries} strings
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Recent Projects</h2>
              {totalProjects > 5 && (
                <Button asChild variant="link" size="sm">
                  <Link href="/dashboard/projects">View all</Link>
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                >
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-sm">{project.name}</CardTitle>
                      <CardAction>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{project.formatId}</Badge>
                          {project.sourceLanguage && project.targetLanguage && (
                            <Badge variant="secondary">
                              {project.sourceLanguage} →{" "}
                              {project.targetLanguage}
                            </Badge>
                          )}
                          <Badge
                            variant={
                              project.status === "completed"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {project.status}
                          </Badge>
                        </div>
                      </CardAction>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
