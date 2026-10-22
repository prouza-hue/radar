import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
export default defineSchema({
 ...authTables,
 tvPairings:defineTable({challenge:v.string(),userCode:v.string(),deviceName:v.string(),expiresAt:v.number(),nextPollAt:v.number(),status:v.union(v.literal("pending"),v.literal("approved"),v.literal("denied"),v.literal("consumed")),userId:v.optional(v.id("users")),consumedAt:v.optional(v.number())}).index("challenge",["challenge"]).index("code",["userCode"]).index("expiry",["expiresAt"]),
 tvDevices:defineTable({userId:v.id("users"),sessionId:v.id("authSessions"),name:v.string(),expiresAt:v.number(),lastSeenAt:v.number(),revokedAt:v.optional(v.number())}).index("user",["userId"]).index("session",["sessionId"]).index("expiry",["expiresAt"]),
 tvPairLimits:defineTable({key:v.string(),count:v.number(),resetAt:v.number()}).index("key",["key"]).index("expiry",["resetAt"]),
 users:defineTable({name:v.optional(v.string()),image:v.optional(v.string()),email:v.optional(v.string()),emailVerificationTime:v.optional(v.number()),phone:v.optional(v.string()),phoneVerificationTime:v.optional(v.number()),isAnonymous:v.optional(v.boolean()),googleSubject:v.optional(v.string())}).index("email",["email"]).index("google_subject",["googleSubject"]),
 watched_episodes:defineTable({userId:v.id("users"),titleKey:v.string(),season:v.number(),episode:v.number(),watchedAt:v.number(),watched:v.optional(v.boolean())}).index("user_title_season",["userId","titleKey","season"]).index("identity",["userId","titleKey","season","episode"]),
 notification_deliveries:defineTable({eventId:v.id("notification_events"),subscriptionId:v.id("notification_subscriptions"),status:v.string(),attempts:v.number(),nextAttemptAt:v.number(),leaseUntil:v.optional(v.number()),errorCode:v.optional(v.number())}).index("identity",["eventId","subscriptionId"]).index("due",["status","nextAttemptAt"]),

 undo_actions:defineTable({userId:v.id("users"),payload:v.any(),expiresAt:v.number(),used:v.boolean()}).index("user",["userId"]),
 action_receipts:defineTable({userId:v.id("users"),requestId:v.string(),result:v.any()}).index("identity",["userId","requestId"]),
 titles:defineTable({key:v.string(),data:v.any(),updatedAt:v.number(),refreshAt:v.number(),followers:v.number()}).index("key",["key"]).index("refresh",["refreshAt"]),
 series:defineTable({titleKey:v.string(),status:v.string()}).index("title",["titleKey"]),
 seasons:defineTable({titleKey:v.string(),number:v.number(),data:v.any()}).index("title",["titleKey"]),
 episodes:defineTable({titleKey:v.string(),season:v.number(),number:v.number(),data:v.any()}).index("title",["titleKey"]),
 title_external_ids:defineTable({titleKey:v.string(),provider:v.string(),externalId:v.string()}).index("title",["titleKey"]),
 title_ratings:defineTable({titleKey:v.string(),provider:v.string(),value:v.number(),votes:v.optional(v.number()),updatedAt:v.number()}).index("title",["titleKey"]),
 streaming_availability:defineTable({titleKey:v.string(),region:v.string(),data:v.any(),updatedAt:v.number()}).index("title_region",["titleKey","region"]),
 user_titles:defineTable({userId:v.id("users"),titleKey:v.string(),addedAt:v.number(),notifications:v.boolean(),saved:v.optional(v.boolean()),movieSeen:v.optional(v.boolean()),liked:v.optional(v.boolean()),hidden:v.optional(v.boolean()),revision:v.optional(v.number())}).index("user",["userId"]).index("user_title",["userId","titleKey"]).index("title",["titleKey"]),
 notification_preferences:defineTable({userId:v.id("users"),region:v.string(),timezone:v.string(),dayBefore:v.boolean(),onRelease:v.boolean()}).index("user",["userId"]),
 notification_subscriptions:defineTable({userId:v.id("users"),endpoint:v.string(),p256dh:v.string(),auth:v.string(),createdAt:v.number()}).index("user",["userId"]).index("endpoint",["endpoint"]),
 notification_events:defineTable({userId:v.id("users"),eventKey:v.string(),titleKey:v.string(),heading:v.string(),body:v.string(),releaseDate:v.optional(v.string()),episodeSeason:v.optional(v.number()),episodeNumber:v.optional(v.number()),isTest:v.optional(v.boolean()),status:v.string(),attempts:v.number(),createdAt:v.number()}).index("dedupe",["userId","eventKey"]).index("status",["status"]),
 metadata_sync:defineTable({key:v.string(),data:v.any(),updatedAt:v.number(),expiresAt:v.number()}).index("key",["key"]),
});
