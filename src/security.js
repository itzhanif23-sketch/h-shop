import crypto from "node:crypto";
export function requireAdmin(req, res, next) {
  if (req.session?.admin?.id) return next();
  return res.status(401).json({ error: "Admin login required." });
}
export function originGuard(req, res, next) {
  if (["GET","HEAD","OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || origin !== process.env.APP_ORIGIN)
    return res.status(403).json({ error: "Request origin rejected." });
  next();
}
export function newOrderId() {
  return "HS-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}
