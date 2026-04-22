import { config } from "dotenv";

config({ path: ".env.local", override: true });
config({ path: ".env.test", override: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for integration tests.");
}
process.env.EMAIL_MODE = process.env.EMAIL_MODE || "log";
