import { getKv } from "@/database/db.ts";

const kv = await getKv();

console.log("📦 Database Contents (kv.db):");
console.log("--------------------------------");

let count = 0;
for await (const entry of kv.list({ prefix: [] })) {
  console.log(`Key: ${JSON.stringify(entry.key)}`);
  console.log(`Val:`, entry.value);
  console.log("---");
  count++;
}

if (count === 0) {
  console.log("Database is empty.");
} else {
  console.log(`\nTotal entries: ${count}`);
}