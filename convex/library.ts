import {internal} from "./_generated/api";
import type {Id} from "./_generated/dataModel";
import {v} from "convex/values";
import {paginationOptsValidator,paginationResultValidator} from "convex/server";
import {query,mutation,internalMutation,type MutationCtx} from "./_generated/server";
import {getAuthUserId} from "./sessionUser";
export const me=query({args:{},returns:v.any(),handler:async ctx=>{const id=await getAuthUserId(ctx);if(!id)return null;const u=await ctx.db.get(id);return u?{email:u.email,name:u.name}:null;}});
export const list=query({args:{paginationOpts:paginationOptsValidator},returns:paginationResultValidator(v.any()),handler:async(ctx,a)=>{
 const userId=await getAuthUserId(ctx);if(!userId)return {page:[],isDone:true,continueCursor:""};
 const p=await ctx.db.query("user_titles").withIndex("user",q=>q.eq("userId",userId)).filter(q=>q.neq(q.field("saved"),false)).order("desc").paginate(a.paginationOpts);
 return {...p,page:await Promise.all(p.page.map(async row=>({...row,title:(await ctx.db.query("titles").withIndex("key",q=>q.eq("key",row.titleKey)).unique())?.data||null})))};
}});
export const membership=query({args:{key:v.string()},returns:v.any(),handler:async(ctx,{key})=>{const userId=await getAuthUserId(ctx);if(!userId)return null;const row=await ctx.db.query("user_titles").withIndex("user_title",q=>q.eq("userId",userId).eq("titleKey",key)).unique();return row?.saved===false?null:row;}});
export const setSaved=mutation({args:{key:v.string(),saved:v.boolean()},returns:v.any(),handler:async(ctx,{key,saved})=>{
 const userId=await getAuthUserId(ctx);if(!userId)return {ok:false,message:"Nejdřív se přihlas."};
 const t=await ctx.db.query("titles").withIndex("key",q=>q.eq("key",key)).unique();if(!t)return {ok:false,message:"Nejdřív načti detail titulu."};
 const old=await ctx.db.query("user_titles").withIndex("user_title",q=>q.eq("userId",userId).eq("titleKey",key)).unique();
 if(saved&&old?.saved===false){await ctx.db.patch(old._id,{saved:true,revision:(old.revision||0)+1});await ctx.db.patch(t._id,{followers:t.followers+1});}
 if(saved&&!old){await ctx.db.insert("user_titles",{userId,titleKey:key,addedAt:Date.now(),notifications:false});await ctx.db.patch(t._id,{followers:t.followers+1,refreshAt:Math.min(t.refreshAt,Date.now()+3600000)});}
 if(!saved&&old&&old.saved!==false){await ctx.db.patch(old._id,{saved:false,notifications:false,revision:(old.revision||0)+1});await ctx.db.patch(t._id,{followers:Math.max(0,t.followers-1)});}
 return {ok:true};
}});
export const setReminder=mutation({args:{key:v.string(),enabled:v.boolean()},returns:v.any(),handler:async(ctx,{key,enabled})=>{
 const userId=await getAuthUserId(ctx);if(!userId)return {ok:false,message:"Nejdřív se přihlas."};
 const row=await ctx.db.query("user_titles").withIndex("user_title",q=>q.eq("userId",userId).eq("titleKey",key)).unique();if(!row||row.saved===false)return {ok:false,message:"Nejdřív přidej titul do Mých."};
 await ctx.db.patch(row._id,{notifications:enabled,revision:(row.revision||0)+1});return {ok:true};
}});

async function enableSeriesBatch(ctx:MutationCtx,userId:Id<"users">,provider:"tmdb"|"tvmaze",after:string,cutoff:number):Promise<{count:number;background:boolean}>{
 const prefix=provider+":tv:";
 const rows=await ctx.db.query("user_titles").withIndex("user_title",q=>q.eq("userId",userId).gt("titleKey",after||prefix).lt("titleKey",provider+":tv;")).take(50);
 let count=0;for(const row of rows){if(row.addedAt<=cutoff&&row.saved!==false){count++;if(!row.notifications)await ctx.db.patch(row._id,{notifications:true,revision:(row.revision||0)+1});}}
 if(rows.length===50)await ctx.scheduler.runAfter(0,internal.library.enableSeriesContinuation,{userId,provider,after:rows[rows.length-1].titleKey,cutoff});
 return {count,background:rows.length===50};
}
export const enableSeriesContinuation=internalMutation({
 args:{userId:v.id("users"),provider:v.union(v.literal("tmdb"),v.literal("tvmaze")),after:v.string(),cutoff:v.number()},
 returns:v.null(),
 handler:async(ctx,a):Promise<null>=>{await enableSeriesBatch(ctx,a.userId,a.provider,a.after,a.cutoff);return null;}
});
export const enableAllSeriesReminders=mutation({
 args:{},returns:v.object({ok:v.boolean(),message:v.string()}),
 handler:async(ctx):Promise<{ok:boolean;message:string}>=>{
 const userId=await getAuthUserId(ctx);if(!userId)return {ok:false,message:"Nejdřív se přihlas."};
 const device=await ctx.db.query("notification_subscriptions").withIndex("user",q=>q.eq("userId",userId)).take(1);
 if(!device.length)return {ok:false,message:"Nejdřív povol upozornění na zařízení."};
 const cutoff=Date.now(),a=await enableSeriesBatch(ctx,userId,"tmdb","",cutoff),b=await enableSeriesBatch(ctx,userId,"tvmaze","",cutoff);
 return {ok:true,message:a.background||b.background?"Upozornění zapínáme pro všechny sledované seriály. Zbytek seznamu dokončíme na pozadí.":a.count+b.count?"Upozornění zapnuta pro všechny sledované seriály ("+(a.count+b.count)+").":"Zatím nesleduješ žádný seriál."};
 }});
