import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default async function Page() {
	const session = await auth();
	if (session) redirect("/dashboard");

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-base">Universal Translation</CardTitle>
					<CardDescription>
						Sign in to your RxLab account to continue.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						action={async () => {
							"use server";
							await signIn("rxlab");
						}}
					>
						<Button className="w-full" size="lg">
							Sign in with RxLab
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
