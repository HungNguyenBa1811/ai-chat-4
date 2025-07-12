import { pgTable, serial, text, integer, timestamp, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { subjects } from "./schema.js";

// Videos table
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  duration: real("duration"), // in seconds
  transcript: text("transcript"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Video chunks table for transcript segments
export const videoChunks = pgTable("video_chunks", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videos.id),
  startTime: real("start_time").notNull(), // in seconds
  endTime: real("end_time").notNull(), // in seconds
  text: text("text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const videosRelations = relations(videos, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [videos.subjectId],
    references: [subjects.id],
  }),
  chunks: many(videoChunks),
}));

export const videoChunksRelations = relations(videoChunks, ({ one }) => ({
  video: one(videos, {
    fields: [videoChunks.videoId],
    references: [videos.id],
  }),
}));

// Zod schemas for validation
export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
});

export const insertVideoChunkSchema = createInsertSchema(videoChunks).omit({
  id: true,
  createdAt: true,
});

// TypeScript types
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type VideoChunk = typeof videoChunks.$inferSelect;
export type InsertVideoChunk = z.infer<typeof insertVideoChunkSchema>;