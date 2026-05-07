## Foreground message pings (realtime + local notifications)

When the app is open, the OS often suppresses notification UI for incoming pushes.
For chat, we still want an immediate in-app cue (banner/sound/haptic) when a new
message arrives via Supabase Realtime and the user is **not** actively viewing
that conversation.

### Why we send a local notification even if push exists

- **Realtime is fast**: inserts arrive in <1s; push from the `notify` Edge Function
  is often 2–10s late.
- **Push pipelines break in the real world**: EAS builds frequently ship with
  misconfigured FCM/APNs credentials during development. In that case, realtime
  + local notification is the *only* reliable cue.

### Trade-off: possible duplicates

We accept the risk of a duplicate alert (OS push + local) in exchange for avoiding
silence. If the user is actively viewing the conversation, we skip both sound and
haptic because the message is already appearing inline.

