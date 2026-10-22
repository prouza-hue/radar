import {v} from "convex/values";
import {paginationOptsValidator, paginationResultValidator} from "convex/server";
import {getAuthUserId} from "./sessionUser";
import {query} from "./_generated/server";
import {progressOf} from "../src/lib/personal-model";

/** Compact pages cap history reads. The UI exhausts them automatically rather
 * than defining the personal radar as its first fifty database relations.
 */
export const page = query({
  args: {paginationOpts: paginationOptsValidator, day: v.string()}, returns: paginationResultValidator(v.any()),
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {page: [], isDone: true, continueCursor: ""};
    const result = await ctx.db.query("user_titles").withIndex("user", q => q.eq("userId", userId)).order("desc")
      .paginate({...a.paginationOpts, numItems: Math.min(6, a.paginationOpts.numItems)});
    const entries = await Promise.all(result.page.map(async row => {
      const historyQuery = () => ctx.db.query("watched_episodes").withIndex("user_title_season", q => q.eq("userId", userId).eq("titleKey", row.titleKey));
      if (row.saved === false && !row.movieSeen) {
        const visibleHistory = await historyQuery().filter(q => q.neq(q.field("watched"), false)).first();
        if (!visibleHistory) return null;
      }
      const title = await ctx.db.query("titles").withIndex("key", q => q.eq("key", row.titleKey)).unique();
      if (!title) return {...row, title: null, unavailable: true, progress: progressOf({title: null}, a.day),
        timelineReady: false, timelineRefreshAt: 0, progressLimited: false};
      const history = title.data.type === "tv" ? await historyQuery().take(2001) : [];
      const watched = history.filter(e => e.watched !== false).map(e => ({season: e.season, number: e.episode}));
      const timeline = title.data.type === "tv" ? await ctx.db.query("metadata_sync").withIndex("key", q => q.eq("key", "timeline:v3:" + row.titleKey)).unique() : null;
      const progress = progressOf({title: title.data, watched, movieSeen: row.movieSeen, timeline: timeline?.data, progressLimited: history.length > 2000}, a.day);
      const summaryTitle = {...title.data, episodes: [], notificationEpisodes: []};
      return {...row, title: summaryTitle, unavailable: false, progress, timelineReady: !!timeline,
        timelineRefreshAt: timeline?.expiresAt || 0, progressLimited: history.length > 2000};
    }));
    return {...result, page: entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)};
  },
});
export const preferences = query({
  args: {paginationOpts: paginationOptsValidator}, returns: paginationResultValidator(v.any()),
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {page: [], isDone: true, continueCursor: ""};
    const result = await ctx.db.query("user_titles").withIndex("user", q => q.eq("userId", userId)).order("desc").paginate(a.paginationOpts);
    return {...result, page: result.page.map(r => ({
      key: r.titleKey, saved: r.saved !== false, liked: !!r.liked, hidden: !!r.hidden,
      seen: !!r.movieSeen, revision: r.revision || 0,
    }))};
  },
});
