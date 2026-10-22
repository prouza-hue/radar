import {v} from "convex/values";
import {internalQuery} from "./_generated/server";
import {browserUserId} from "./sessionUser";

/** Actions do not have a database handle; keep account administration on the
 * same active-session/browser-only authorization path as device approval. */
export const browser = internalQuery({args:{},returns:v.union(v.id("users"),v.null()),handler:ctx=>browserUserId(ctx)});
