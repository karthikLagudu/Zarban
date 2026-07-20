import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "cloudflare:workers";

const binding = (env as unknown as { DB?: any }).DB;

if (!binding) throw new Error("Cloudflare D1 binding `DB` is unavailable");

export const prisma = new PrismaClient({ adapter: new PrismaD1(binding) });
