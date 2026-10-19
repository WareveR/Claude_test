# Reminders (Web Push)

Reminders are Web Push notifications signed with a VAPID key pair. Without the keys the Worker
sends nothing and Settings says Reminders aren't set up.

## Set up once, at deploy

1. Make a key pair: `node scripts/vapid-keys.mjs`.
2. Store all three as Worker secrets, pasting only the value after `=` (the Worker also strips
   a pasted `NAME=`, quotes and spaces):

   ```sh
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   npx wrangler secret put VAPID_SUBJECT   # mailto:the-recovery-email
   ```

3. On each phone: Settings › Reminders › Allow notifications. On iPhone, add the app to the
   Home Screen first and open it from there; Safari tabs can't receive pushes.

The key pair in `.dev.vars.example` is for local development only.

## Changing the keys

The easiest way is Actions › **New VAPID keys** › Run workflow: it makes a pair and stores both
secrets, never printing them. A malformed key makes the Worker log "VAPID keys are malformed"
and Settings say Reminders aren't set up.

Every device's subscription is tied to the public key. After changing it, each device must
open Settings › Reminders and allow notifications again.

## How sending works

The Scheduler runs every 5 minutes. It sends the Reminders due since its last run (at most an
hour back, so a long outage doesn't flood phones), records each in `reminder_sent` so none goes
twice, and removes subscriptions the push service reports as gone (404 or 410).
