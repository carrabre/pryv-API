ALTER TABLE "User" ADD COLUMN "authType" varchar DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "authMethod";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "displayName";