// Seeds the database: imports the generated SME workbook through the same
// parser/importer the admin panel uses, creates the RBAC admin accounts and
// default settings.

import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { parseWorkbook } from "../src/lib/excel/parser";
import { commitImport } from "../src/lib/excel/importer";

async function main() {
  const wbPath = path.join(
    process.cwd(),
    "data",
    "Adaptive_Math_SME_Template_v3_FILLED.xlsx"
  );
  if (!fs.existsSync(wbPath)) {
    throw new Error(
      `Workbook not found at ${wbPath}. Run "npm run generate:workbook" first.`
    );
  }

  console.log("Parsing workbook…");
  const parsed = parseWorkbook(fs.readFileSync(wbPath));
  const errors = parsed.issues.filter((i) => i.severity === "error");
  const warnings = parsed.issues.filter((i) => i.severity === "warning");
  if (errors.length > 0) {
    console.error("Validation errors:");
    for (const e of errors.slice(0, 20)) {
      console.error(`  [${e.sheet} row ${e.row} ${e.column}] ${e.message}`);
    }
    throw new Error(`${errors.length} validation errors — aborting seed`);
  }
  if (warnings.length > 0) {
    console.log(`${warnings.length} warnings (non-blocking).`);
  }

  console.log("Importing into database…");
  const summary = await commitImport(parsed);
  console.log(
    `  skills=${summary.skills} edges=${summary.knowledgeGraphEdges} questions=${summary.questions} traps=${summary.traps} qmatrix=${summary.qMatrix} dims=${summary.dimensions}`
  );

  console.log("Creating admin users…");
  const users = [
    { email: "admin@zarban.local", name: "Admin", role: "Admin", password: "admin123" },
    { email: "teacher@zarban.local", name: "Teacher", role: "Teacher", password: "teacher123" },
    { email: "viewer@zarban.local", name: "Viewer", role: "Viewer", password: "viewer123" },
    { email: "editor@zarban.local", name: "Content Editor", role: "Editor", password: "editor123" },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.adminUser.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, role: u.role, passwordHash },
      update: { role: u.role },
    });
  }

  console.log("Setting defaults…");
  const settings: [string, string][] = [["max_questions", "30"]];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }

  console.log("Seed complete.");
  console.log("  Admin logins: admin@zarban.local/admin123, teacher@zarban.local/teacher123, viewer@zarban.local/viewer123");
  console.log("  Content portal: editor@zarban.local/editor123 (or admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
