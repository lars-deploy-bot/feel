import type { Config } from "drizzle-kit"

export default {
	schema: "./apps/web/lib/db/schema.ts",
	out: "./drizzle/migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: process.env.DATABASE_PATH || "/var/lib/claude-bridge/database.sqlite",
	},
} satisfies Config
