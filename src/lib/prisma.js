import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the process. Reused across requests so we
// don't exhaust the connection pool. No fit math lives here — services stay
// pure and take plain objects (see CLAUDE.md conventions).
const prisma = new PrismaClient();

export default prisma;
