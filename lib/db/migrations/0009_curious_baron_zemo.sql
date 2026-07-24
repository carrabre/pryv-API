CREATE INDEX IF NOT EXISTS "Chat_userId_createdAt_idx" ON "Chat" USING btree ("userId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_v2_chatId_createdAt_idx" ON "Message_v2" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_v2_chatId_role_createdAt_idx" ON "Message_v2" USING btree ("chatId","role","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Stream_chatId_createdAt_idx" ON "Stream" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Suggestion_documentId_createdAt_idx" ON "Suggestion" USING btree ("documentId","documentCreatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User" USING btree ("email");