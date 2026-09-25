// The in-app guide and "What's new" history.
// ⚠️ When a feature is added or changed, update the topics below AND add a CHANGELOG entry for the new version.
//    tools/check-release.mjs (run before every release) fails if the newest CHANGELOG entry doesn't match APP_VERSION
//    or if a screen has no help topic.
//
// Topic body blocks: a string is a paragraph; { steps: [...] } is a numbered list; { tip: '...' } is a highlighted tip.

export const SECTIONS = ['Getting started', 'Workouts', 'Exercises', 'Body stats', 'Friends', 'Leaderboards & badges', 'Your settings', 'Backup', 'Feedback', 'Troubleshooting'];

export const TOPICS = [
  // ---------- Getting started ----------
  { id: 'install', section: 'Getting started', title: 'Put the app on your home screen', keywords: 'install pwa phone icon add to home screen',
    body: ['The app works in any browser, but it feels best installed like a normal app.',
      { steps: ['iPhone (Safari): tap the Share button, then “Add to Home Screen”.', 'Android (Chrome): tap ⋮, then “Install app” (or “Add to Home screen”).'] },
      'Open it from the new icon from then on.'] },
  { id: 'tabs', section: 'Getting started', title: 'Finding your way around', keywords: 'tabs menu navigation bottom bar',
    body: ['The bar at the bottom has five tabs:',
      { steps: ['Train: start workouts, your routines and recent workouts.', 'Friends: your friends’ workouts and badges, and friend requests.', 'Ranks: leaderboards for you and your friends.', 'Body: bodyweight and measurements.', 'Me: your profile, avatar, badges, exercises, settings, backup and feedback.'] },
      { tip: 'The ? button at the top opens help for the screen you’re on.' }] },
  { id: 'offline', section: 'Getting started', title: 'Using it with no signal', keywords: 'offline internet wifi signal sync upload gym basement',
    body: ['You can log a whole workout with no signal. Everything is saved on your phone and uploads automatically when you’re back online.',
      'While changes are waiting, the top bar shows “Offline · N to sync”. Me → Sync shows the same and has a “Try now” button.',
      { tip: 'Don’t sign out while changes are waiting to upload — they’d be lost.' },
      'A few things need a connection: friends, leaderboards, the feedback board, and importing a backup.'] },

  // ---------- Workouts ----------
  { id: 'start-workout', section: 'Workouts', title: 'Start a workout', keywords: 'begin train empty session', screens: [''],
    body: [{ steps: ['Go to Train.', 'Tap “Start” next to a routine — its exercises are filled in for you — or “Start empty workout” to add exercises as you go.', 'Use “＋ Add exercise” to add more. Search, filter by body area, or type a new name to create one.'] },
      'If you leave the app mid-workout, the Train tab changes to “Workout” and a “Resume” card takes you back.'] },
  { id: 'log-sets', section: 'Workouts', title: 'Log sets (and “Last” numbers)', keywords: 'set reps weight tick log previous last time prefill', screens: ['workout'],
    body: ['Each exercise has a row per set: weight, reps and a ✓ button.',
      { steps: ['Check the weight and reps (they’re pre-filled from last time).', 'Tap ✓ to log the set — it turns green and the rest timer starts.', 'Tap ✓ again to un-log it.'] },
      'The “Last” column shows what you did for that set the previous time.',
      '“＋ Add set” and “Remove last set” sit under each exercise. The ⋯ menu lets you change the rest time, move the exercise up or down, or remove it.'] },
  { id: 'rest-timer', section: 'Workouts', title: 'Rest timer', keywords: 'rest timer countdown beep vibrate', screens: ['workout'],
    body: ['The timer starts when you tick a set. Use −15 / +15 to adjust it, or Skip to stop it. It beeps and vibrates when time’s up.',
      'Change an exercise’s rest time from its ⋯ menu, or set it in the routine.',
      { tip: 'Phones pause web apps when the screen is locked, so the beep may not play then — the countdown is still correct when you come back.' }] },
  { id: 'finish-workout', section: 'Workouts', title: 'Finish or discard a workout', keywords: 'finish end save discard cancel', screens: ['workout'],
    body: ['Tap Finish at the top. You can then:', { steps: ['Update the routine you started from with today’s exercises, or', 'Save the workout as a new routine.'] },
      '“Discard workout” at the bottom deletes everything logged in it.'] },
  { id: 'routines', section: 'Workouts', title: 'Create and edit routines', keywords: 'routine template plan push pull legs day', screens: ['routine'],
    body: [{ steps: ['On Train, tap “＋ New” next to Routines.', 'Name it (e.g. “Push day”) and add exercises.', 'Set sets, reps and rest for each; use ↑ ↓ to reorder.', 'Tap “Save routine”.'] },
      'Each exercise also has a “Left & right” switch — see “Left & right exercises”.',
      'Tap a routine’s name to edit or delete it. Past workouts are kept if you delete a routine.'] },
  { id: 'history', section: 'Workouts', title: 'Workout history', keywords: 'history past previous workouts delete', screens: ['history'],
    body: ['Train → “All history” (or Me → Workout history) lists your finished workouts. Tap one to see every set and estimated 1-rep maxes, or to delete it.'] },

  // ---------- Exercises ----------
  { id: 'exercise-library', section: 'Exercises', title: 'Your exercise library', keywords: 'exercise create new custom rename delete library', screens: ['exercises'],
    body: ['Me → Exercises lists your own exercises and the built-in ones. Search or filter by body area.',
      { steps: ['Tap “＋ New” to create an exercise: give it a name, a body area and, if needed, switch on Left & right.', 'Tap any exercise to open its page.'] },
      'On your own exercises you can rename them, change the body area, or delete them. Deleting also deletes the sets you logged for it (you’ll be warned). Built-in exercises can’t be renamed or deleted.'] },
  { id: 'exercise-page', section: 'Exercises', title: 'An exercise’s page and progress', keywords: 'progress chart e1rm best heaviest sessions', screens: ['exercise'],
    body: ['Each exercise’s page shows your best estimated 1-rep max, heaviest set, a progress chart and every session. Tap or drag on the chart to see values.',
      'Estimated 1-rep max uses the Epley formula and only counts sets of 12 reps or fewer.'] },
  { id: 'left-right', section: 'Exercises', title: 'Left & right (unilateral) exercises', keywords: 'unilateral left right side single arm leg L R', screens: ['exercise', 'workout', 'routine'],
    body: ['For one-arm or one-leg exercises, switch on “Unilateral (left & right)”. Each set then has an L row and an R row, each with its own ✓ (and each starts the rest timer).',
      'You can switch it on:', { steps: ['when creating the exercise,', 'on the exercise’s page,', 'under the exercise in the routine editor, or', 'in the exercise’s machine settings during a workout.'] },
      'The setting belongs to the exercise, so it applies everywhere you use it. “Last” numbers and pre-filled values are kept per side.',
      { tip: 'If you switch it mid-workout after logging sets, it applies the next time you add that exercise.' }] },
  { id: 'machine-settings', section: 'Exercises', title: 'Machine & seat settings', keywords: 'seat height machine brand model adjustment notes settings', screens: ['exercise', 'workout'],
    body: ['Tap an exercise’s name during a workout (or “Edit” on its page) to save the machine brand and model, seat height, any other adjustments (e.g. “Back pad: 3”) and notes.',
      'They show under the exercise name every time you do it. Only you can see them.'] },

  // ---------- Body ----------
  { id: 'body-stats', section: 'Body stats', title: 'Track bodyweight & measurements', keywords: 'bodyweight weight measurement waist chest body fat chart', screens: ['body'],
    body: [{ steps: ['Open Body and pick a stat from the chips at the top.', 'Enter the value and date, then tap Add.'] },
      'The chart shows your trend — tap or drag on it to see values. Tap ✕ on an entry to delete it.'] },
  { id: 'body-sharing', section: 'Body stats', title: 'Choose what friends can see', keywords: 'privacy share private friends see body', screens: ['body'],
    body: ['Every body stat is private until you switch on “Friends can see” for that stat. You can share bodyweight but keep your waist private, for example. Friends see shared stats on your friend page.'] },

  // ---------- Friends ----------
  { id: 'add-friends', section: 'Friends', title: 'Add friends', keywords: 'friend request username add accept decline', screens: ['friends'],
    body: [{ steps: ['Friends → Friends tab.', 'Type your friend’s username and tap Add.', 'They accept the request on their Friends tab.'] },
      'Your username is shown there so you can share it. Only accepted friends see your workouts, routines and badges.'] },
  { id: 'feed', section: 'Friends', title: 'The feed', keywords: 'feed activity friends workouts badges', screens: ['feed'],
    body: ['Friends → Feed shows your friends’ finished workouts and badges they’ve earned, newest first. Tap a workout to see its sets.'] },
  { id: 'friend-page', section: 'Friends', title: 'A friend’s page & copying routines', keywords: 'copy routine friend page remove unfriend', screens: ['friend'],
    body: ['Tap a friend to see their badges, routines, recent workouts and any body stats they share.',
      'Tap “Copy” on a routine to add it to your own routines. You can remove a friend at the bottom of their page.'] },

  // ---------- Leaderboards & badges ----------
  { id: 'leaderboards', section: 'Leaderboards & badges', title: 'How the leaderboards work', keywords: 'ranks leaderboard best lift progress volume activity streak', screens: ['ranks'],
    body: ['Leaderboards compare you with your friends:',
      { steps: ['Best lift: highest estimated 1-rep max for the chosen exercise.', 'Progress: % change in best estimated 1-rep max, last 4 weeks vs the 4 weeks before (you need sessions in both).', 'Volume: total weight × reps since Monday.', 'Activity: workouts this week, weekly streak and workouts in the last 30 days.'] },
      'For left & right exercises, each side counts as its own set.'] },
  { id: 'badges', section: 'Leaderboards & badges', title: 'Badges', keywords: 'badge achievement award earn streak pr', screens: ['badges'],
    body: ['There are 25 badges for workouts, streaks, personal records, total volume, friends and body check-ins. Me → Badges shows them all — faded ones are still to earn, with how to get them.',
      'Badges are worked out from your real logged data after each workout, and a pop-up tells you when you earn one. Friends see your badges on your page and in their feed.'] },

  // ---------- Settings ----------
  { id: 'avatar', section: 'Your settings', title: 'Change your avatar', keywords: 'avatar picture icon profile colour',
    body: ['On Me, tap your picture. Pick one of the drawings (animals, athletes, creatures, emblems) or an emoji, choose a background colour, and tap Save. Friends see it next to your name.'] },
  { id: 'appearance', section: 'Your settings', title: 'Colours, dark mode & units', keywords: 'theme dark light mode colour accent units kg lb',
    body: ['Me → Appearance: choose Auto (follows your phone), Light or Dark, and an accent colour — or any colour with the rainbow circle. Colours are adjusted automatically to stay readable, and are saved on this device.',
      'Me → Units switches between kg/cm and lb/in. Everyone sees everyone’s numbers in their own units.'] },
  { id: 'account', section: 'Your settings', title: 'Username, password & signing out', keywords: 'username rename password sign out log out account',
    body: ['On Me you can rename your username, change your password, and sign out (at the bottom).',
      'Forgot your password? Use “Forgot password?” on the sign-in screen.'] },
  { id: 'updates', section: 'Your settings', title: 'App updates', keywords: 'update version new refresh banner whats new',
    body: ['When a new version is out, a banner says “Version X is available — tap to update”. After updating, a “What’s new” card shows the changes once.',
      'Your version is shown at the bottom of Me, with “Check for updates”. The full history is under “What’s new” in this guide.'] },

  // ---------- Backup ----------
  { id: 'backup', section: 'Backup', title: 'Export & import your data', keywords: 'backup export import restore file download move account',
    body: ['Me → Backup → “Export my data” downloads everything (workouts, routines, body stats, exercise settings) as a file. Keep a copy now and then.',
      '“Import a backup” restores a file. You choose what happens if something already exists:',
      { steps: ['Keep what I have — only adds what’s missing (safe to run twice).', 'Backup wins — adds what’s missing and replaces your current versions.', 'Replace everything — deletes your current data first, then restores the file (asks you to confirm).'] },
      'You can import into a different account too, e.g. to move your history.'] },

  // ---------- Feedback ----------
  { id: 'feedback', section: 'Feedback', title: 'Request a feature or report a bug', keywords: 'feedback feature request bug report idea vote comment', screens: ['feedback'],
    body: ['Me → Feature requests & bug reports is a board everyone using the app can see.',
      { steps: ['Tap “＋ New post”, pick Feature request or Bug report, add a title and details.', 'Upvote posts you agree with (▲) and add comments.', 'Filter by type, sort by Top or New, and show Active or Closed posts.'] },
      'Bug reports include your app version and device type automatically. The app owner sets each post’s status: Open, Planned, In progress, Done or Won’t do.'] },

  // ---------- Troubleshooting ----------
  { id: 'cant-connect', section: 'Troubleshooting', title: 'The app can’t reach the server', keywords: 'error server paused supabase not loading connect', screens: [],
    body: ['First check your connection. If everyone gets errors at once, the free database may have paused after about a week with nobody using it — the app owner can restore it in Supabase with one click. Your logged workouts wait on your phone until it’s back.'] },
  { id: 'update-missing', section: 'Troubleshooting', title: 'I can’t see a new feature', keywords: 'old version refresh cache update not showing', screens: [],
    body: ['Check the version at the bottom of Me. If it’s older than expected, tap “Check for updates”, or close and reopen the app.'] },
];

// Newest first. Every release adds an entry here (the guide check enforces it).
export const CHANGELOG = [
  { version: '1.4.0', date: '2026-09-25', items: [
    'Help & guide: tap ? at the top of any screen for help with that screen, or search all topics.',
    'A “What’s new” card like this one appears once after each update.'] },
  { version: '1.3.0', date: '2026-09-25', items: [
    'Me → Exercises: create, rename and delete your own exercises.',
    'Switch Left & right on when creating an exercise, on its page, or in the routine editor.',
    '40 new drawn avatars: animals, athletes, creatures and emblems.',
    'Feature requests & bug reports board with upvotes and comments.'] },
  { version: '1.2.0', date: '2026-09-25', items: [
    'Version number and an “update available” banner.',
    'Appearance: light/dark/auto and accent colours.',
    'Left & right (unilateral) exercises.',
    'Avatars and 25 badges your friends can see.'] },
  { version: '1.1.0', date: '2026-09-25', items: ['Import a backup, with three ways to handle duplicates.'] },
  { version: '1.0.0', date: '2026-09-25', items: ['First release: workouts, routines, rest timer, body stats, friends, feed and leaderboards.'] },
];

/** Help topic for a screen (first path part of the URL, e.g. 'workout', 'ranks'). */
export function topicForScreen(screen) {
  return TOPICS.find(t => (t.screens || []).includes(screen)) || null;
}
