ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "walletAddress" varchar(42);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "authMethod" varchar(20) DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "displayName" varchar(100);