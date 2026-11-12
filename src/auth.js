const crypto = require("node:crypto");

const ADMIN_SESSION_COOKIE = "companion_admin_session";
const VISITOR_COOKIE = "companion_visitor_id";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const sessions = new Map();

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const index = item.indexOf("=");
      if (index === -1) return acc;
      const key = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function appendSetCookie(response, cookieValue) {
  const existing = response.getHeader("Set-Cookie");
  if (!existing) {
    response.setHeader("Set-Cookie", cookieValue);
    return;
  }

  const nextValue = Array.isArray(existing) ? [...existing, cookieValue] : [existing, cookieValue];
  response.setHeader("Set-Cookie", nextValue);
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  const {
    path = "/",
    httpOnly = true,
    sameSite = "Lax",
    maxAge,
    secure = false
  } = options;

  if (path) parts.push(`Path=${path}`);
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  if (httpOnly) parts.push("HttpOnly");
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createPasswordRecord(password) {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, passwordSalt);
  return { passwordSalt, passwordHash };
}

function verifyPassword(password, passwordSalt, passwordHash) {
  if (!passwordSalt || !passwordHash) return false;
  const calculated = hashPassword(password, passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(passwordHash, "hex"));
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function issueAdminSession(response, username) {
  cleanupSessions();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  appendSetCookie(
    response,
    serializeCookie(ADMIN_SESSION_COOKIE, token, {
      maxAge: Math.floor(SESSION_TTL_MS / 1000)
    })
  );
}

function getAdminSession(request) {
  cleanupSessions();
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return {
    token,
    username: session.username,
    expiresAt: session.expiresAt
  };
}

function clearAdminSession(request, response) {
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (token) sessions.delete(token);

  appendSetCookie(
    response,
    serializeCookie(ADMIN_SESSION_COOKIE, "", {
      maxAge: 0
    })
  );
}

function ensureVisitorId(request, response) {
  const cookies = parseCookies(request.headers.cookie);
  let visitorId = cookies[VISITOR_COOKIE];

  if (!visitorId) {
    visitorId = crypto.randomUUID();
    appendSetCookie(
      response,
      serializeCookie(VISITOR_COOKIE, visitorId, {
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false
      })
    );
  }

  return visitorId;
}

module.exports = {
  ADMIN_SESSION_COOKIE,
  VISITOR_COOKIE,
  createPasswordRecord,
  ensureVisitorId,
  getAdminSession,
  issueAdminSession,
  parseCookies,
  verifyPassword,
  clearAdminSession
};
