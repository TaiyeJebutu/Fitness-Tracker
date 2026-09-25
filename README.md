# Fitness Tracker

A free workout tracker for you and your friends. It covers routines, set logging, a rest timer, machine and seat settings, body stats, a friends feed and leaderboards. It runs in any phone browser and can be added to your home screen like an app.

**Cost: £0.** It runs on two free services, and neither asks for a card:

| Part | Service | Free limits (as of 2026) |
|---|---|---|
| The app's web address | GitHub Pages | Plenty for a personal site |
| Database and logins | Supabase free plan | 500 MB database (years of logs for a group of friends), 50,000 monthly users |

> ⚠️ **The one catch:** Supabase pauses a free project after about **7 days with nobody using it**. It emails you first. To wake it up, open supabase.com → your project → **Restore project**. This is free and takes a minute or two. Using the app at least once a week keeps it awake. As an extra safety net, everyone can download a backup at any time from **Me → Export my data**.

---

## One-time setup (about 20 minutes)

### Step 1: Create the database (Supabase)

1. Go to **supabase.com** → **Start your project** and sign up. Signing in with GitHub is easiest; see step 4 if you don't have a GitHub account yet.
2. Click **New project**.
   - **Name:** `fitness-tracker`
   - **Database password:** click *Generate* and save it somewhere. You're unlikely to need it.
   - **Region:** *West EU (London)*, or whichever is closest to you
   - **Plan:** Free
3. Wait about 2 minutes while it sets up.

### Step 2: Create the tables

1. In the left sidebar, open **SQL Editor** → **New query**.
2. Open the file `supabase/schema.sql` from this folder, copy **all** of it, and paste it in.
3. Click **Run**. You should see *"Success. No rows returned"*.

This sets up the tables, the built-in exercise list, the leaderboards and the privacy rules (who can see what).

### Step 3: Sign-in settings

1. Go to **Authentication** → **Sign In / Providers** → **Email**. On some dashboard versions this is under *Providers*.
2. Turn **off** "Confirm email" and click **Save**.
   *Why:* Supabase's free email sender only sends a few emails per hour. With this off, people can sign up instantly and no emails are needed.
3. Go to **Authentication** → **URL Configuration** and set **Site URL** to your app's address from step 5, for example `https://yourname.github.io/fitness-tracker/`. You can come back to this after step 5. It's only used for "Forgot password" emails.

### Step 4: Put the app online (GitHub Pages)

1. Sign up at **github.com** if you don't have an account. It's free.
2. Click **+** (top right) → **New repository**.
   - **Name:** `fitness-tracker`
   - **Public**: GitHub Pages is free for public repositories. Your *data* is not public. Only the app's code is, and it contains no secrets.
   - Click **Create repository**.
3. On the new page, click **uploading an existing file**.
4. Unzip the folder I gave you. Drag **everything inside it** (`index.html`, `css`, `js`, `icons`, `supabase`, `sw.js`, `manifest.webmanifest`, `README.md`) into the upload box, then click **Commit changes**.

### Step 5: Connect the app to your database

1. In Supabase, click **Connect** at the top of your project, or go to **Project Settings → API Keys**. Copy:
   - the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - the **Publishable key** (starts `sb_publishable_…`). If you only see "anon public" (a long `eyJ…` key), use that one instead.
   - ❌ Never use the **secret** / **service_role** key.
2. In your GitHub repository, open `js/config.js` → click the ✏️ pencil icon.
3. Replace the two placeholder values with the ones you copied:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: 'https://abcdefgh.supabase.co',
     SUPABASE_KEY: 'sb_publishable_xxxxxxxxxxxx',
   };
   ```
4. Click **Commit changes**.

### Step 6: Switch on the website

1. In your repository, go to **Settings** → **Pages**.
2. Under **Build and deployment → Source**, pick **Deploy from a branch**. For branch, pick **main** and **/ (root)**, then click **Save**.
3. Wait 1–2 minutes and refresh. The page will show your address, for example `https://yourname.github.io/fitness-tracker/`.
4. Go back to step 3.3 and paste this address into Supabase's Site URL.

### Step 7: Install it on your phone

- **iPhone (Safari):** open the address → **Share** button → **Add to Home Screen**.
- **Android (Chrome):** open the address → **⋮** menu → **Install app** (or *Add to Home screen*).

Create your account, then send your friends the link and your username. They sign up and add you under **Friends**.

---

## Using it

- **Train:** start a routine or an empty workout. Enter the weight and reps, then tap ✓ to log the set. This also starts the rest timer. The **Last** column shows what you did last time, and new sets are pre-filled with those numbers.
- **Machine settings:** tap an exercise's name to save its machine brand and model, seat height, any other adjustments (e.g. "Back pad: 3") and notes. They'll show up every time you do that exercise. Only you can see them.
- **Custom exercises:** in the exercise picker, type a name that isn't in the list and tap *Create*.
- **No signal?** Keep logging. Changes are saved on your phone and upload automatically when you're back online. The top bar shows "Offline · N to sync" until then.
- **Body:** log bodyweight and measurements. Each stat has its own **Friends can see** switch, and stats are private until you turn it on.
- **Friends:** send requests by username. Accepted friends can see your workouts and routines (and can copy your routines), plus any body stats you've chosen to share.
- **Ranks:** leaderboards for you and your friends:
  - *Best lift:* estimated 1-rep max per exercise
  - *Progress:* % change in estimated 1RM over the last 4 weeks vs the 4 weeks before
  - *Volume:* weight × reps since Monday
  - *Activity:* workouts this week, plus your weekly streak
- **Units:** each person picks kg/cm or lb/in under **Me**. Everyone sees everyone else's numbers in their own units.

## Good to know

- **Privacy:** the database enforces who can see what, not just the app. Non-friends can't see your workouts, routines, custom exercises or body stats. Friends only see the body stats you've shared. Nobody else ever sees your machine settings.
- **Anyone with the link can create an account**, but they can't see anything of yours unless you accept their friend request.
- **Rest timer alerts:** it beeps and vibrates when the app is open. Phones (especially iPhones) pause web apps in the background, so the alert may not fire with the screen locked. The countdown stays correct when you come back.
- **Updating the app later:** upload the changed files to GitHub the same way. If a phone keeps showing the old version, close and reopen the app.
