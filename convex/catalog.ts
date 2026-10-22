import {rankRecommendations, selectRecommendationSeeds} from "../src/lib/personal-model";
import {v} from "convex/values";
import {action, internalQuery, internalMutation, internalAction, query} from "./_generated/server";
import {internal} from "./_generated/api";
import {searchTitles, getTitle, getSeason, hotTitles, hasTmdb, getTimeline} from "./providers";
import {buildRecommendationBundle} from "./recommendationBundle";
import type {Title} from "../src/lib/types";

export const config = query({args: {}, returns: v.object({tmdb: v.boolean(), push: v.boolean()}), handler: () => ({tmdb: hasTmdb(), push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)})});
export const readCache = internalQuery({args: {key: v.string()}, returns: v.any(), handler: (ctx, {key}) => ctx.db.query("metadata_sync").withIndex("key", q => q.eq("key", key)).unique()});
export const saveCache = internalMutation({args: {key: v.string(), data: v.any(), ttl: v.number()}, returns: v.null(), handler: async (ctx, a) => {
  const old = await ctx.db.query("metadata_sync").withIndex("key", q => q.eq("key", a.key)).unique();
  const doc = {key: a.key, data: a.data, updatedAt: Date.now(), expiresAt: Date.now() + a.ttl};
  if (old) await ctx.db.patch(old._id, doc); else await ctx.db.insert("metadata_sync", doc);
  return null;
}});
export const readTitle = internalQuery({args: {key: v.string()}, returns: v.any(), handler: (ctx, {key}) => ctx.db.query("titles").withIndex("key", q => q.eq("key", key)).unique()});
export const saveTitle = internalMutation({args: {data: v.any()}, returns: v.null(), handler: async (ctx, {data}) => {
  const t = data as Title, old = await ctx.db.query("titles").withIndex("key", q => q.eq("key", t.key)).unique();
  const days = t.next?.date ? (Date.parse(t.next.date) - Date.now()) / 86400000 : 999;
  const ttl = days <= 2 ? 2 * 3600000 : days <= 7 ? 6 * 3600000 : 86400000;
  const doc = {key: t.key, data: t, updatedAt: Date.now(), refreshAt: Date.now() + ttl, followers: old?.followers || 0};
  if (old) await ctx.db.patch(old._id, doc); else await ctx.db.insert("titles", doc);
  return null;
}});
export const search = action({args: {q: v.string()}, returns: v.any(), handler: async (ctx, {q}): Promise<any> => {
  q = q.trim().slice(0, 120); if (q.length < 2) return {titles: [], mode: hasTmdb() ? "tmdb" : "tvmaze"};
  const key = `search:${Boolean(hasTmdb())}:${q.toLowerCase()}`;
  const cache = await ctx.runQuery(internal.catalog.readCache, {key});
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  const data = {titles: await searchTitles(q), mode: hasTmdb() ? "tmdb" : "tvmaze"};
  await ctx.runMutation(internal.catalog.saveCache, {key, data, ttl: 900000}); return data;
}});
export const detail = action({args: {key: v.string()}, returns: v.any(), handler: async (ctx, {key}): Promise<Title> => {
  const cached = await ctx.runQuery(internal.catalog.readTitle, {key});
  if (cached && cached.data.metadataVersion === 2 && cached.refreshAt > Date.now()) return cached.data;
  const t = await getTitle(key); await ctx.runMutation(internal.catalog.saveTitle, {data: t}); return t;
}});
export const season = action({args: {key: v.string(), season: v.number()}, returns: v.any(), handler: async (ctx, a): Promise<any> => {
  if (!/^(tmdb|tvmaze):tv:[0-9]+$/.test(a.key) || !Number.isInteger(a.season) || a.season < 0 || a.season > 200) throw new Error("Neplatná sezóna");
  const key = `${a.key}:season:v2:${a.season}`, old = await ctx.runQuery(internal.catalog.readCache, {key});
  if (old && old.expiresAt > Date.now()) return old.data;
  const data = await getSeason(a.key, a.season); await ctx.runMutation(internal.catalog.saveCache, {key, data, ttl: 21600000}); return data;
}});
export const hot = action({args: {}, returns: v.any(), handler: async (ctx): Promise<any> => {
  const key = "hot:v4:" + hasTmdb(), old = await ctx.runQuery(internal.catalog.readCache, {key});
  if (old && old.expiresAt > Date.now()) return old.data;
  try {const data = await hotTitles(); await ctx.runMutation(internal.catalog.saveCache, {key, data, ttl: 2 * 3600000}); return data;}
  catch (error) {if (old) return old.data; throw error;}
}});
export const due = internalQuery({args: {}, returns: v.any(), handler: async ctx => ctx.db.query("titles").withIndex("refresh", q => q.lte("refreshAt", Date.now())).filter(q => q.gt(q.field("followers"), 0)).take(20)});
export const refresh = internalAction({args: {}, returns: v.null(), handler: async (ctx): Promise<null> => {
  const titles = await ctx.runQuery(internal.catalog.due, {});
  for (const t of titles) {
    try {const data = await getTitle(t.key); await ctx.runMutation(internal.catalog.saveTitle, {data});}
    catch {console.warn("metadata_refresh_failed", t.key);}
  }
  return null;
}});
export const timeline = action({args: {key: v.string()}, returns: v.any(), handler: async (ctx, {key}): Promise<any> => {
  if (!/^(tmdb|tvmaze):tv:[0-9]+$/.test(key)) throw new Error("Neplatný seriál");
  const cacheKey = "timeline:v3:" + key, old = await ctx.runQuery(internal.catalog.readCache, {key: cacheKey});
  if (old && old.expiresAt > Date.now()) return old.data;
  const title = await ctx.runQuery(internal.catalog.readTitle, {key}), t = title?.data || await getTitle(key);
  const data = await getTimeline(t); await ctx.runMutation(internal.catalog.saveCache, {key: cacheKey, data, ttl: 6 * 3600000}); return data;
}});
export const recommendations = action({args: {}, returns: v.any(), handler: async (ctx): Promise<any> => {
  const seedRows = await ctx.runQuery(internal.personal.seeds, {});
  const profile: any[] = [];
  for (const row of seedRows) {
    const doc = await ctx.runQuery(internal.catalog.readTitle, {key: row.titleKey});
    if (doc?.data) profile.push({titleKey: row.titleKey, addedAt: row.addedAt || 0, title: doc.data});
  }
  const seeds = selectRecommendationSeeds(profile.filter(seed => seed.title?.source === "tmdb"), 8);
  const all: any[] = []; let partial = profile.length > 0 && seeds.length === 0;
  for (let start = 0; start < seeds.length; start += 2) {
    const bundles = await Promise.all(seeds.slice(start, start + 2).map(async (seed: any) => {
      const key = "recommendations:v10:" + seed.titleKey, old = await ctx.runQuery(internal.catalog.readCache, {key});
      try {
        if (old && old.expiresAt > Date.now()) return old.data;
        const data = await buildRecommendationBundle(seed.title);
        await ctx.runMutation(internal.catalog.saveCache, {key, data, ttl: data.partial ? 3600000 : 86400000});
        return data;
      } catch {return {items: old?.data?.items || [], partial: true};}
    }));
    for (const bundle of bundles) {all.push(...bundle.items); partial ||= !!bundle.partial;}
  }
  const keys = [...new Set(all.map(item => item.title.key))] as string[];
  const excluded: string[] = [];
  for (let i = 0; i < keys.length; i += 100) excluded.push(...await ctx.runQuery(internal.personal.exclusions, {keys: keys.slice(i, i + 100)}));
  return {
    items: rankRecommendations(all, excluded),
    seedCount: profile.length,
    activeSeedCount: seeds.length,
    partial,
    taste: profile.map(seed => ({
      key: seed.titleKey, name: seed.title.name, originalName: seed.title.originalName,
      type: seed.title.type, year: seed.title.year, poster: seed.title.poster,
    })),
  };
}});
