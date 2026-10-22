import {v} from "convex/values";
import {query, mutation, type MutationCtx} from "./_generated/server";
import {getAuthUserId} from "./sessionUser";
import type {Id} from "./_generated/dataModel";

export const season = query({args: {titleKey: v.string(), season: v.number()}, returns: v.array(v.number()), handler: async (ctx, a) => {
  const userId = await getAuthUserId(ctx); if (!userId) return [];
  const rows = await ctx.db.query("watched_episodes").withIndex("user_title_season", q => q.eq("userId", userId).eq("titleKey", a.titleKey).eq("season", a.season)).take(1001);
  return rows.filter(r => r.watched !== false).map(r => r.episode);
}});
async function apply(ctx: MutationCtx, userId: Id<"users">, titleKey: string, season: number, numbers: number[], watched: boolean) {
  const items: {id: Id<"watched_episodes">; before: boolean; revision: number}[] = [];
  const relation = await ctx.db.query("user_titles").withIndex("user_title", q => q.eq("userId", userId).eq("titleKey", titleKey)).unique();
  const relationId = relation?._id || await ctx.db.insert("user_titles", {userId, titleKey, addedAt: Date.now(), notifications: false, saved: false});
  for (const episode of [...new Set(numbers)]) {
    const old = await ctx.db.query("watched_episodes").withIndex("identity", q => q.eq("userId", userId).eq("titleKey", titleKey).eq("season", season).eq("episode", episode)).unique();
    const before = !!old && old.watched !== false; if (before === watched) continue;
    const revision = Math.max(Date.now(), (old?.watchedAt || 0) + 1);
    const id = old?._id || await ctx.db.insert("watched_episodes", {userId, titleKey, season, episode, watched, watchedAt: revision});
    if (old) await ctx.db.patch(id, {watched, watchedAt: revision});
    items.push({id, before, revision});
  }
  if (!items.length) return null;
  // A lightweight preference query can now invalidate recommendations after watching.
  await ctx.db.patch(relationId, {revision: (relation?.revision || 0) + 1});
  return ctx.db.insert("undo_actions", {userId, payload: {kind: "episodes", items}, expiresAt: Date.now() + 300000, used: false});
}
const valid = (key: string, season: number, episodes: number[]) => /^(tmdb|tvmaze):tv:[0-9]+$/.test(key) && Number.isInteger(season) && season >= 0 && season <= 200 && episodes.length <= 1000 && episodes.every(n => Number.isInteger(n) && n >= 0 && n <= 1000);
const day = () => new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());

// Keep the published contracts for older clients unchanged.
export const set = mutation({args: {titleKey: v.string(), season: v.number(), episode: v.number(), watched: v.boolean()}, returns: v.object({ok: v.boolean(), message: v.optional(v.string())}), handler: async (ctx, a) => {
  const userId = await getAuthUserId(ctx); if (!userId) return {ok: false, message: "Nejdřív se přihlas."};
  if (!valid(a.titleKey, a.season, [a.episode])) return {ok: false, message: "Neplatná epizoda."};
  await apply(ctx, userId, a.titleKey, a.season, [a.episode], a.watched); return {ok: true};
}});
export const setSeason = mutation({args: {titleKey: v.string(), season: v.number(), episodes: v.array(v.number()), watched: v.boolean()}, returns: v.object({ok: v.boolean(), message: v.optional(v.string())}), handler: async (ctx, a) => {
  const userId = await getAuthUserId(ctx); if (!userId) return {ok: false, message: "Nejdřív se přihlas."};
  if (!valid(a.titleKey, a.season, a.episodes)) return {ok: false, message: "Neplatná sezóna."};
  await apply(ctx, userId, a.titleKey, a.season, a.episodes, a.watched); return {ok: true};
}});
export const changeSeason = mutation({args: {titleKey: v.string(), season: v.number(), watched: v.boolean()}, returns: v.any(), handler: async (ctx, a) => {
  const userId = await getAuthUserId(ctx); if (!userId) return {ok: false, message: "Nejdřív se přihlas."};
  if (!valid(a.titleKey, a.season, [])) return {ok: false, message: "Neplatná sezóna."};
  const cache = await ctx.db.query("metadata_sync").withIndex("key", q => q.eq("key", a.titleKey + ":season:v2:" + a.season)).unique();
  const title = await ctx.db.query("titles").withIndex("key", q => q.eq("key", a.titleKey)).unique();
  const episodes = cache?.data || (title?.data.source === "tvmaze" ? title.data.episodes : []);
  const numbers = episodes.filter((e: any) => e.season === a.season && e.date && e.date.slice(0, 10) <= day()).map((e: any) => e.number);
  if (!numbers.length) return {ok: false, message: "Nejsou potvrzené vydané díly."};
  const undoId = await apply(ctx, userId, a.titleKey, a.season, numbers, a.watched);
  return {ok: true, undoId};
}});

/** New UI path: one confirmed episode, an exact undo token, no client-supplied dates. */
export const markReleased = mutation({
  args: {titleKey: v.string(), season: v.number(), episode: v.number(), watched: v.boolean()}, returns: v.any(),
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx); if (!userId) return {ok: false, message: "Nejdřív se přihlas."};
    if (!valid(a.titleKey, a.season, [a.episode])) return {ok: false, message: "Neplatná epizoda."};
    if (a.watched) {
      const [timeline, seasonCache, title] = await Promise.all([
        ctx.db.query("metadata_sync").withIndex("key", q => q.eq("key", "timeline:v3:" + a.titleKey)).unique(),
        ctx.db.query("metadata_sync").withIndex("key", q => q.eq("key", a.titleKey + ":season:v2:" + a.season)).unique(),
        ctx.db.query("titles").withIndex("key", q => q.eq("key", a.titleKey)).unique(),
      ]);
      const candidates = [...(seasonCache?.data || []), ...(timeline?.data?.episodes || []), ...(title?.data?.episodes || [])];
      const confirmed = candidates.find(e => e.season === a.season && e.number === a.episode && e.date && e.date.slice(0, 10) <= day());
      if (!confirmed) return {ok: false, message: "Vydání tohoto dílu zatím není potvrzené. Obnov detail a zkus to znovu."};
    }
    const undoId = await apply(ctx, userId, a.titleKey, a.season, [a.episode], a.watched);
    return {ok: true, undoId};
  },
});
