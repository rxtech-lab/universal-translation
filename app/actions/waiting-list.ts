"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { waitingList } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
const COOKIE_NAME = "waiting_list_email";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function joinWaitingList(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    const existing = await db
      .select({ id: waitingList.id })
      .from(waitingList)
      .where(eq(waitingList.email, trimmedEmail))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(waitingList).values({
        id: crypto.randomUUID(),
        email: trimmedEmail,
        approved: false,
        createdAt: new Date(),
      });
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, trimmedEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });

    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function getWaitingListStatus(
  email: string,
): Promise<{ onList: boolean; approved: boolean }> {
  if (!email) return { onList: false, approved: false };

  const result = await db
    .select({ approved: waitingList.approved })
    .from(waitingList)
    .where(eq(waitingList.email, email.trim().toLowerCase()))
    .limit(1);

  if (result.length === 0) return { onList: false, approved: false };
  return { onList: true, approved: result[0].approved };
}
