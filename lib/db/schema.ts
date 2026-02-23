import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const waitingList = sqliteTable("waiting_list", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  formatId: text("format_id").notNull(),
  sourceLanguage: text("source_language"),
  targetLanguage: text("target_language"),
  sourceLocale: text("source_locale"),
  targetLocale: text("target_locale"),
  status: text("status").notNull().default("draft"),
  blobUrl: text("blob_url"),
  content: text("content", { mode: "json" }),
  formatData: text("format_data", { mode: "json" }),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const terms = sqliteTable("terms", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  originalText: text("original_text").notNull(),
  translation: text("translation").notNull().default(""),
  comment: text("comment"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
