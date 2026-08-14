import { existsSync } from "node:fs";

// Reuses the same local Postgres connection @rtcom/db is configured with,
// so these integration tests run against a real database, not a mock.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
} else if (existsSync("../db/.env")) {
  process.loadEnvFile("../db/.env");
}
