# Cloud sync with Supabase

The app works without this: everything saves to the browser on the device you use. Connect a free Supabase project and you can sign in, keep a backup of every workout, and use the same account on your phone and laptop.

## Set up (about 5 minutes)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste in everything from [`supabase/schema.sql`](supabase/schema.sql), and run it. This makes the `workouts` and `user_data` tables and locks them so each person can only read their own rows.
3. Open **Project Settings → API Keys** and copy the project URL and the **publishable** key (the older **anon** key works too). Never use the secret / `service_role` key in the app.
4. Copy `.env.example` to `.env.local` and paste them in:

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

## Tables

| Table | One row per | Holds |
| --- | --- | --- |
| `workouts` | finished workout | type, date, and each exercise's sets as JSON |
| `user_data` | person | plans, custom plans, settings, exercises added to muscles |

You can browse your data in Supabase's **Table Editor**.
