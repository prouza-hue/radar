import {getAuthUserId as authUserId, getAuthSessionId} from "@convex-dev/auth/server";
import type {QueryCtx, MutationCtx} from "./_generated/server";
import type {Id} from "./_generated/dataModel";

/** Convex JWTs remain cryptographically valid until expiry. Checking the session
 * row makes a remote TV revocation effective on the very next private data call.
 * Existing auth providers and legacy subject-only test identities are unchanged.
 */
export async function getAuthUserId(ctx: Pick<QueryCtx | MutationCtx, "auth" | "db">): Promise<Id<"users"> | null> {
  const userId = await authUserId(ctx);
  if (!userId) return null;
  const sessionId = await getAuthSessionId(ctx);
  if (sessionId) {
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId || session.expirationTime <= Date.now()) return null;
    const device = await ctx.db.query("tvDevices").withIndex("session", q => q.eq("sessionId", sessionId)).unique();
    if (device && (device.userId !== userId || device.revokedAt || device.expiresAt <= Date.now())) return null;
  }
  return userId;
}
export async function browserUserId(ctx: Pick<QueryCtx | MutationCtx, "auth" | "db">) {
  const userId = await getAuthUserId(ctx); if (!userId) return null;
  const sessionId = await getAuthSessionId(ctx);
  if (sessionId && await ctx.db.query("tvDevices").withIndex("session", q => q.eq("sessionId", sessionId)).unique()) return null;
  return userId;
}
