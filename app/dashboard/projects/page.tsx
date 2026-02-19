import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardAction,
} from "@/components/ui/card";
import { Plus } from "lucide-react";

export default async function ProjectsPage() {
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
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
		})
		.from(projects)
		.where(eq(projects.userId, session.user.id))
		.orderBy(desc(projects.updatedAt));

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="flex items-center justify-between px-4 lg:px-6">
				<div>
					<h1 className="text-lg font-semibold">Translations</h1>
					<p className="text-muted-foreground text-sm">
						Manage your translation projects
					</p>
				</div>
				<Button asChild size="sm">
					<Link href="/dashboard/projects/new">
						<Plus className="h-3.5 w-3.5 mr-1" />
						New Project
					</Link>
				</Button>
			</div>

			<div className="px-4 lg:px-6">
				{userProjects.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-12">
							<p className="text-sm text-muted-foreground mb-4">
								No projects yet. Upload a translation file to get started.
							</p>
							<Button asChild variant="outline" size="sm">
								<Link href="/dashboard/projects/new">
									<Plus className="h-3.5 w-3.5 mr-1" />
									Create your first project
								</Link>
							</Button>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-3">
						{userProjects.map((project) => (
							<Link key={project.id} href={`/dashboard/projects/${project.id}`}>
								<Card className="hover:bg-accent/50 transition-colors cursor-pointer">
									<CardHeader>
										<CardTitle className="text-sm">{project.name}</CardTitle>
										<CardAction>
											<div className="flex items-center gap-2">
												<Badge variant="outline">{project.formatId}</Badge>
												{project.sourceLanguage && project.targetLanguage && (
													<Badge variant="secondary">
														{project.sourceLanguage} → {project.targetLanguage}
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
				)}
			</div>
		</div>
	);
}
