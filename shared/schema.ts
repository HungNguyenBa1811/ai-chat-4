import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  firebaseUid: text("firebase_uid").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  description: text("description"),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  title: text("title").notNull().default("Cuộc trò chuyện mới"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => chatSessions.id).notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'theory' or 'exercise'
  content: text("content").notNull(),
  chunks: text("chunks").notNull(), // JSON string
  pageCount: integer("page_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});



export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  theme: text("theme").default("light"),
  gptModel: text("gpt_model").default("gpt-4o"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  chatSessions: many(chatSessions),
  settings: one(userSettings),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  chatSessions: many(chatSessions),
  documents: many(documents),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  subject: one(subjects, {
    fields: [chatSessions.subjectId],
    references: [subjects.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Temporary documents table for chat uploads
export const temporaryDocuments = pgTable("temporary_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: integer("session_id").notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'theory' or 'exercise'
  content: text("content").notNull(),
  chunks: text("chunks").notNull(), // JSON string
  pageCount: integer("page_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Temporary document chunks table for vector storage
export const temporaryDocumentChunks = pgTable("temporary_document_chunks", {
  id: serial("id").primaryKey(),
  temporaryDocumentId: integer("temporary_document_id").notNull().references(() => temporaryDocuments.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: integer("session_id").notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [documents.subjectId],
    references: [subjects.id],
  }),
  chunks: many(documentChunks),
}));

export const temporaryDocumentsRelations = relations(temporaryDocuments, ({ one, many }) => ({
  user: one(users, {
    fields: [temporaryDocuments.userId],
    references: [users.id],
  }),
  session: one(chatSessions, {
    fields: [temporaryDocuments.sessionId],
    references: [chatSessions.id],
  }),
  subject: one(subjects, {
    fields: [temporaryDocuments.subjectId],
    references: [subjects.id],
  }),
  chunks: many(temporaryDocumentChunks),
}));

export const temporaryDocumentChunksRelations = relations(temporaryDocumentChunks, ({ one }) => ({
  temporaryDocument: one(temporaryDocuments, {
    fields: [temporaryDocumentChunks.temporaryDocumentId],
    references: [temporaryDocuments.id],
  }),
  user: one(users, {
    fields: [temporaryDocumentChunks.userId],
    references: [users.id],
  }),
  session: one(chatSessions, {
    fields: [temporaryDocumentChunks.sessionId],
    references: [chatSessions.id],
  }),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));



export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().optional(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});



export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertTemporaryDocumentSchema = createInsertSchema(temporaryDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertTemporaryDocumentChunkSchema = createInsertSchema(temporaryDocumentChunks).omit({
  id: true,
  createdAt: true,
});



// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type TemporaryDocument = typeof temporaryDocuments.$inferSelect;
export type InsertTemporaryDocument = z.infer<typeof insertTemporaryDocumentSchema>;
export type TemporaryDocumentChunk = typeof temporaryDocumentChunks.$inferSelect;
export type InsertTemporaryDocumentChunk = z.infer<typeof insertTemporaryDocumentChunkSchema>;

// Video tables - isolated and easy to remove
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  webdavUrl: text("webdav_url"), // WebDAV URL if from cloud storage
  duration: real("duration"), // in seconds
  transcript: text("transcript"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transcript chunks table - separate from video chunks for better organization
export const transcriptChunks = pgTable("transcript_chunks", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videos.id),
  startTime: real("start_time").notNull(), // in seconds
  endTime: real("end_time").notNull(), // in seconds
  text: text("text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Video relations
export const videosRelations = relations(videos, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [videos.subjectId],
    references: [subjects.id],
  }),
  transcriptChunks: many(transcriptChunks),
}));

export const transcriptChunksRelations = relations(transcriptChunks, ({ one }) => ({
  video: one(videos, {
    fields: [transcriptChunks.videoId],
    references: [videos.id],
  }),
}));

// Video Zod schemas
export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
});

export const insertTranscriptChunkSchema = createInsertSchema(transcriptChunks).omit({
  id: true,
  createdAt: true,
});

// Video types
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type TranscriptChunk = typeof transcriptChunks.$inferSelect;
export type InsertTranscriptChunk = z.infer<typeof insertTranscriptChunkSchema>;

