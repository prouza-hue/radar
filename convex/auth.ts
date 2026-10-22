import { convexAuth } from "@convex-dev/auth/server"
import {MacalyGoogle} from "./MacalyGoogle"
import {TvDevice} from "./TvDevice"
import {createProviderUser} from "./authUsers"
import { ResendOTP } from "./ResendOTP"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP,MacalyGoogle,TvDevice],
  callbacks:{createOrUpdateUser:createProviderUser},
  session:{totalDurationMs:1000*60*60*24*30},
})
