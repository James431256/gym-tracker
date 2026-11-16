# Cloud sync with Supabase

The app works without this: everything saves to the browser on the device you use. Connect a free Supabase project and you can sign in, keep a backup of every workout, and use the same account on your phone and laptop.

## This repo's project

The app is already connected to the Supabase project `gym-tracker` ([dashboard](https://supabase.com/dashboard/project/uisdaueslzibzjwlxeng)). The tables from `supabase/schema.sql` are set up, and the URL and publishable key are in `.env`. Run `npm start`, go to **Plans**, tap **Sign in**, then **Create account**.

## Set up your own project (about 5 minutes)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste in everything from [`supabase/schema.sql`](supabase/schema.sql), and run it. This makes the `workouts` and `user_data` tables and locks them so each person can only read their own rows.
3. Open **Project Settings → API Keys** and copy the project URL and the **publishable** key (the older **anon** key works too). Never use the secret / `service_role` key in the app.
4. Copy `.env.example` to `.env.local` and paste them in. `.env.local` overrides the committed `.env`:

   ```
   REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
   REACT_APP_SUPABASE_KEY=sb_publishable_...
   ```

5. Restart `npm start`. Go to **Plans** and tap **Sign in**, then **Create account**.

If you host the app (Vercel, Netlify and so on), add the same two variables in the host's environment settings and redeploy.

### Email confirmation

New Supabase projects ask people to confirm their email before they can sign in. That's fine. If you're the only user and want to skip it, turn off **Authentication → Sign In / Providers → Email → Confirm email**.

The free plan's built-in email sender only sends a few emails an hour, so if a confirmation email doesn't arrive, wait a bit before trying again.

## How syncing works

- The browser copy stays the working copy, so logging sets never waits on the network. Gym wifi can be patchy.
- Finishing or deleting a workout adds it to an upload queue. The queue uploads straight away when you're online, and otherwise when the connection comes back.
- Your plans, settings and the exercises you add to each muscle upload a moment after you change them.
- When you open the app, or switch back to it, it pulls down the account's copy, so changes from your other devices show up.
- The first time you sign in on a device, any workouts already on it upload to your account.
- Signing out clears this device's copy. Everything that's synced stays in your account.

A workout in progress stays on the device you started it on until you tap **Finish**.

## Staying awake

Free Supabase projects pause after a week with little database activity. The **Keep Supabase awake** GitHub Action (`.github/workflows/keep-supabase-awake.yml`) calls a small `keep_alive()` function once a day so that doesn't happen. You can see its runs, or run it by hand, under the repo's **Actions** tab.

If the project does get paused, the app keeps working on your phone. Resume the project from the Supabase dashboard and anything waiting uploads.

## Tables

| Table | One row per | Holds |
| --- | --- | --- |
| `workouts` | finished workout | type, date, gym, and each exercise's sets as JSON |
| `user_data` | person | plans, custom plans, settings (including your gyms), exercises added to muscles |

You can browse your data in Supabase's **Table Editor**.

## Friends

**Plans → Friends** lets people link up with a six-character code and see each other's training days and streaks. It's off until you pick a display name there.

| Table | One row per | Holds |
| --- | --- | --- |
| `profiles` | person who set up friends | display name, friend code, whether sharing is paused |
| `friendships` | pair of people | who asked, who was asked, and `pending` or `accepted` |
| `workout_summaries` | finished workout | the workout's name, its date, and three counts: exercises, sets, and sets up on last time |

- Friends only ever see `workout_summaries`. Weights, reps, exercise names and gyms stay in `workouts`, which only you can read.
- Once you have a profile, the app keeps your summaries in step with your workouts: it adds or updates one when you finish or edit a workout and removes it when you delete one.
- You can read a friend's summaries only after they accept, and only while they haven't turned on **Pause sharing**. You can read someone's name once a request is waiting between you.
- Requests are sent with the `send_friend_request(code)` function, not by writing to `friendships`. The person asked accepts by changing the row to `accepted`. Either person can delete the row to decline, cancel or unlink.
