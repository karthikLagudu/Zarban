// Point the built Worker config at YOUR Cloudflare D1 database, so you don't
// have to hand-edit JSON before `wrangler deploy`.
//
//   node scripts/patch-d1.mjs <database_id> [database_name]
//
// Run it AFTER `npm run build` (the build regenerates dist/server/wrangler.json).
import fs from "fs";
import path from "path";

const [, , id, name = "zarban"] = process.argv;
if (!id) {
  console.error("usage: node scripts/patch-d1.mjs <database_id> [database_name]");
  console.error("  (get <database_id> from `wrangler d1 create zarban`)");
  process.exit(1);
}

const p = path.join("dist", "server", "wrangler.json");
if (!fs.existsSync(p)) {
  console.error(`${p} not found — run "npm run build" first.`);
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
cfg.d1_databases = [{ binding: "DB", database_name: name, database_id: id }];
fs.writeFileSync(p, JSON.stringify(cfg));
console.log(`✓ ${p} now points at D1 "${name}" (${id}). Deploy with:  cd dist/server && npx wrangler deploy`);
