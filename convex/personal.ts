import {v} from "convex/values";
import {paginationOptsValidator, paginationResultValidator} from "convex/server";
import {getAuthUserId} from "./sessionUser";
import {query, mutation, internalQuery} from "./_generated/server";

export const state = query({args: {key: v.string()}, returns: v.any(), handler: async (ctx, {key}) => {
  const userId = await getAuthUserId(ctx); if (!userId) return null;
  return ctx.db.query("user_titles").withIndex("user_title", q => q.eq("userId", userId).eq("titleKey", key)).unique();
}});
export const change = mutation({args: {key: v.string(), field: v.union(v.literal("saved"), v.literal("movieSeen"), v.literal("liked"), v.literal("hidden")), value: v.boolean(), requestId: v.optional(v.string())}, returns: v.any(), handler: async (ctx, a) => {
  const userId = await getAuthUserId(ctx); if (!userId) return {ok: false, message: "Nejdřív se přihlas."};
  if (a.requestId) {
    if (a.requestId.length > 100) return {ok: false, message: "Neplatná akce."};
    const old = await ctx.db.query("action_receipts").withIndex("identity", q => q.eq("userId", userId).eq("requestId", a.requestId!)).unique();
    if (old) return old.result;
  }
  const title = await ctx.db.query("titles").withIndex("key", q => q.eq("key", a.key)).unique();
  if (!title) return {ok: false, message: "Nejdřív načti detail titulu."};
  if (a.field === "movieSeen" && title.data.type !== "movie") return {ok: false, message: "Seriál označuj po epizodách."};
  let row = await ctx.db.query("user_titles").withIndex("user_title", q => q.eq("userId", userId).eq("titleKey", a.key)).unique();
  if (!row) {
    const id = await ctx.db.insert("user_titles", {userId, titleKey: a.key, addedAt: Date.now(), notifications: false, saved: false});
    row = (await ctx.db.get(id))!;
  }
  const before = a.field === "saved" ? row.saved !== false : Boolean(row[a.field]), beforeNotifications = row.notifications;
  if (before === a.value) {
    const result = {ok: true};
    if (a.requestId) await ctx.db.insert("action_receipts", {userId, requestId: a.requestId, result});
    return result;
  }
  const revision = (row.revision || 0) + 1;
  const beforeAddedAt = row.addedAt;
  const patch = {[a.field]: a.value, revision,
    ...(a.field === "saved" && a.value ? {addedAt: Date.now()} : {}),
    ...(a.field === "saved" && !a.value ? {notifications: false} : {})};
  await ctx.db.patch(row._id, patch);
  if (a.field === "saved") await ctx.db.patch(title._id, {followers: Math.max(0, title.followers + (a.value ? 1 : -1))});
  const undoId = await ctx.db.insert("undo_actions", {userId, payload: {kind: "state", id: row._id, field: a.field, before, after: a.value, revision, beforeNotifications, beforeAddedAt}, expiresAt: Date.now() + 300000, used: false});
  const result = {ok: true, undoId};
  if (a.requestId) await ctx.db.insert("action_receipts", {userId, requestId: a.requestId, result});
  return result;
}});
export const undo = mutation({args: {id: v.id("undo_actions")}, returns: v.any(), handler: async (ctx, {id}) => {
  const userId = await getAuthUserId(ctx), action = await ctx.db.get(id);
  if (!userId || !action || action.userId !== userId || action.used || action.expiresAt < Date.now()) return {ok: false, message: "Vrácení už není dostupné."};
  const p = action.payload; let conflicts = 0;
  if (p.kind === "state") {
    const row: any = await ctx.db.get(p.id);
    if (!row || row.userId !== userId || row.revision !== p.revision) conflicts++;
    else {
      await ctx.db.patch(p.id, {[p.field]: p.before, revision: p.revision + 1,
        ...(p.field === "saved" ? {notifications: p.beforeNotifications, addedAt: p.beforeAddedAt ?? row.addedAt} : {})});
      if (p.field === "saved") {
        const title = await ctx.db.query("titles").withIndex("key", q => q.eq("key", row.titleKey)).unique();
        if (title) await ctx.db.patch(title._id, {followers: Math.max(0, title.followers + (p.before ? 1 : -1))});
      }
    }
  } else if (p.kind === "episodes") {
    const changedTitles = new Set<string>();
    for (const item of p.items) {
      const row: any = await ctx.db.get(item.id);
      if (!row || row.userId !== userId || row.watchedAt !== item.revision) {conflicts++; continue;}
      await ctx.db.patch(item.id, {watched: item.before, watchedAt: row.watchedAt + 1});
      changedTitles.add(row.titleKey);
    }
    for (const key of changedTitles) {
      const relation = await ctx.db.query("user_titles").withIndex("user_title", q => q.eq("userId", userId).eq("titleKey", key)).unique();
      if (relation) await ctx.db.patch(relation._id, {revision: (relation.revision || 0) + 1});
    }
  } else if (p.kind === "reminders") {
    for (const item of p.items) {
      const row: any = await ctx.db.get(item.id);
      if (!row || row.userId !== userId || row.revision !== item.revision) {conflicts++; continue;}
      await ctx.db.patch(item.id, {notifications: item.before, revision: item.revision + 1});
    }
  } else return {ok: false, message: "Tuto akci už nelze vrátit."};
  await ctx.db.patch(id, {used: true});
  return {ok: true, message: conflicts ? "Novější změny jsme ponechali." : "Vráceno."};
}});
/** Legacy rich pages remain available to previously published clients. */
export const records = query({args: {paginationOpts: paginationOptsValidator}, returns: paginationResultValidator(v.any()), handler: async (ctx, a) => {
  const userId = await getAuthUserId(ctx); if (!userId) return {page: [], isDone: true, continueCursor: ""};
  const p = await ctx.db.query("user_titles").withIndex("user", q => q.eq("userId", userId)).order("desc").paginate(a.paginationOpts);
  return {...p, page: await Promise.all(p.page.map(async row => {
    const title = await ctx.db.query("titles").withIndex("key", q => q.eq("key", row.titleKey)).unique();
    const watched = await ctx.db.query("watched_episodes").withIndex("user_title_season", q => q.eq("userId", userId).eq("titleKey", row.titleKey)).take(2001);
    const timeline = await ctx.db.query("metadata_sync").withIndex("key", q => q.eq("key", "timeline:v3:" + row.titleKey)).unique();
    return {...row, title: title?.data || null, watched: watched.filter(e => e.watched !== false).map(e => ({season: e.season, number: e.episode})), progressLimited: watched.length > 2000, timeline: timeline?.data || null};
  }))};
}});
export const progress = query({args: {key: v.string()}, returns: v.any(), handler: async (ctx, {key}) => {
  const userId = await getAuthUserId(ctx); if (!userId) return {watched: [], limited: false};
  const rows = await ctx.db.query("watched_episodes").withIndex("user_title_season", q => q.eq("userId", userId).eq("titleKey", key)).take(2001);
  return {watched: rows.filter(e => e.watched !== false).map(e => ({season: e.season, number: e.episode})), limited: rows.length > 2000};
}});
export const seeds = internalQuery({args: {}, returns: v.any(), handler: async ctx => {
  const userId = await getAuthUserId(ctx); if (!userId) return [];
  return ctx.db.query("user_titles").withIndex("user", q => q.eq("userId", userId)).filter(q => q.eq(q.field("liked"), true)).order("desc").take(50);
}});
export const exclusions = internalQuery({args: {keys: v.array(v.string())}, returns: v.array(v.string()), handler: async (ctx, {keys}) => {
  const userId = await getAuthUserId(ctx); if (!userId) return keys;
  const excluded: string[] = [];
  for (const key of keys.slice(0, 150)) {
    const row = await ctx.db.query("user_titles").withIndex("user_title", q => q.eq("userId", userId).eq("titleKey", key)).unique();
    const seen = await ctx.db.query("watched_episodes").withIndex("user_title_season", q => q.eq("userId", userId).eq("titleKey", key)).filter(q => q.neq(q.field("watched"), false)).take(1);
    if ((row && (row.saved !== false || row.movieSeen || row.liked || row.hidden)) || seen.length) excluded.push(key);
  }
  return excluded;
}});
export const includeLegacyHistory = mutation({args: {paginationOpts: paginationOptsValidator}, returns: v.any(), handler: async (ctx, a) => {
  const userId = await getAuthUserId(ctx); if (!userId) return {isDone: true, continueCursor: ""};
  const page = await ctx.db.query("watched_episodes").withIndex("user_title_season", q => q.eq("userId", userId)).paginate(a.paginationOpts);
  for (const row of page.page) {
    if (row.watched === false) continue;
    const old = await ctx.db.query("user_titles").withIndex("user_title", q => q.eq("userId", userId).eq("titleKey", row.titleKey)).unique();
    if (!old) await ctx.db.insert("user_titles", {userId, titleKey: row.titleKey, saved: false, notifications: false, addedAt: row.watchedAt});
  }
  return {isDone: page.isDone, continueCursor: page.continueCursor};
}});
