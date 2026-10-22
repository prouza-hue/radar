import {ConvexCredentials} from "@convex-dev/auth/providers/ConvexCredentials";
import type {ConvexCredentialsConfig} from "@convex-dev/auth/server";
import {internal} from "./_generated/api";
import {secretHash} from "./tvSecurity";

/** No email matching or account creation. The approved browser user owns the
 * resulting normal Convex Auth session and its existing personal records. */
export const TvDevice: ConvexCredentialsConfig = ConvexCredentials({
  id:"tv-device",
  authorize:async(credentials,ctx)=>{
    const challenge=typeof credentials.secret==="string"?secretHash(credentials.secret):null;
    if(!challenge)return null;
    return ctx.runMutation(internal.tvPairing.consume,{challenge});
  },
});
