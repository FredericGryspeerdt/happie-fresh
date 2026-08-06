import { App, staticFiles } from "fresh";
import { sweepDueNotifications } from "@/services/notification-sweep.ts";

// Deno Deploy extracts Deno.cron definitions at deploy time, so this must be at
// module scope in the entry point. Cron runs in UTC, which needs no special
// handling: the sweep compares instants.
//
// The retries are what make the atomic marker claim load-bearing rather than
// theoretical — a handler that fails part-way through a batch is re-run over the
// same fire-points.
Deno.cron(
  "todo-due-notifications",
  "*/5 * * * *",
  { backoffSchedule: [1000, 5000, 10000] },
  async () => {
    await sweepDueNotifications();
  },
);

export const app = new App()
  // Add static file serving middleware
  .use(staticFiles())
  // Enable file-system based routing
  .fsRoutes();
