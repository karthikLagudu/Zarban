import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "cloudflare:workers";

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (client) return client;
  const binding = (env as unknown as { DB?: any }).DB;
  if (!binding) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  client = new PrismaClient({ adapter: new PrismaD1(binding) });
  return client;
}

// Bindings are injected when a Worker request begins, after the module loads.
// The proxy keeps the familiar Prisma API while deferring construction until
// the first query runs inside that request context.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
