import prisma from "./prisma.js";

// Admin auth (spec §7, hard rule #3 multi-tenant). Resolves the secret
// adminToken to exactly one outlet and pins req.outletId. EVERY admin route runs
// this first; downstream handlers must scope all queries by req.outletId and
// never read/write another outlet's data.
//
// Token is read from `Authorization: Bearer <token>` or `X-Admin-Token`.
export async function adminAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "missing_admin_token" });
    }

    // adminToken is not unique in the schema, so findFirst. (Tokens are intended
    // to be unique per outlet; this still resolves to a single outlet.)
    const outlet = await prisma.outlet.findFirst({ where: { adminToken: token } });
    if (!outlet) {
      return res.status(401).json({ error: "invalid_admin_token" });
    }

    req.outletId = outlet.id;
    req.outlet = outlet;
    return next();
  } catch (err) {
    return next(err);
  }
}

function extractToken(req) {
  const auth = req.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const t = auth.slice("Bearer ".length).trim();
    if (t) return t;
  }
  const header = req.get("x-admin-token");
  if (header && header.trim()) return header.trim();
  return null;
}
