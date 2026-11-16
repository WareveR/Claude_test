# Security reference

Who can see and change what, as the code does it today. Roles live on the **Account** (`owner`, `admin`, `member`, plus the **dev** switch); Persons never sign in. Source: `src/worker/require-device.ts`, `private.ts`, `security.ts`, `auth/` and `routes/`. Terms are in `CONTEXT.md`.

Every route except sign-in, setup, recovery, invite acceptance, `/health` and the public Calendar Feed needs a Signed-in Device (`requireDevice`, 401 `signed_out` otherwise). The guards are `requireOwner` (role is owner), `requireAdmin` (role is not member, so Owner and Admin) and `account.dev` (only in `routes/errors.ts`).

## 1. Roles

"Any" means any Signed-in Device, whatever the role, Display Mode aside (which is a per-device screen setting, not an access level).

| Area                                      | Read                                             | Change                                                                                 | Check (file)                                                  |
| ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Members and invites (list, invite, reset) | Owner, Admin                                     | Owner, Admin                                                                           | `requireAdmin` (`members.ts`)                                 |
| Role, dev switch, Person of another Account | Owner, Admin                                  | Owner, Admin; never the Owner's Account (non-Owners get 403), never one's own role     | `members.ts` PATCH                                            |
| Email of another Account                  | Owner, Admin                                     | Only while the invite is pending; an active adult's email only by themselves            | `members.ts` PATCH, `recovery.ts`                             |
| Remove an Account                         | Owner, Admin (a "Removed" list)                 | Owner, Admin; not the Owner, not oneself. Soft delete: `removed_at` is set, devices and tokens are deleted, the row stays so Private items keep their creator; `POST /members/:id/restore` brings it back | `members.ts` DELETE, restore                                  |
| Hand the Family to another adult          | n/a                                              | Owner only (target must be active); Owner becomes Admin                                | `requireOwner` (`members.ts`)                                 |
| Own Person (`PUT /account/person`)        | Any                                              | Owner, Admin only; a Member's Person is set when invited                               | role check in `account.ts`                                    |
| Persons, relatives, nicknames, photos     | Any                                              | **Any, including Members**                                                             | no role check (`persons.ts`, `relatives.ts`, `images.ts`)     |
| Entry Types                               | Any                                              | **Any, including Members**                                                             | no role check (`entry-types.ts`)                              |
| Predefined lists (Checklist templates)    | Any                                              | **Any, including Members**                                                             | no role check (`checklist-templates.ts`)                      |
| Calendar Feeds (create, replace, revoke)  | Any (the address is shown once, at create/replace) | **Any, including Members**                                                           | no role check (`feeds.ts`)                                    |
| Weather Locations (add, remove, select)   | Any                                              | **Any, including Members**                                                             | no role check (`weather.ts`)                                  |
| Public holidays, bins, Sleeping Hours     | Any (sent with the status)                       | Owner, Admin                                                                           | `requireAdmin` (`family.ts`)                                  |
| Entries, Tasks, Checklists, Shopping List | Any (Private excepted, see 2)                    | **Any, including Members** (Private excepted)                                          | `private.ts`                                                  |
| Signed-in Devices                         | Member: own; Owner, Admin: everyone's            | Same: rename or sign out, own devices (Member) or all (Owner, Admin)                   | `reachable()` in `devices.ts`                                 |
| Export (full ZIP data, `.ics`)            | Any; other Accounts' rows only for Owner, Admin  | n/a (`/export/done` records the date; any role)                                        | `export.ts`, Private blanked per viewer                       |
| Danger zone (reset)                       | Owner                                            | Owner, with the Owner's password; a full copy is saved to the Backup bucket first      | `requireOwner` (`reset.ts`)                                   |
| Error Log                                 | Owner, Admin, or anyone with dev                 | Any device may add an error and report one; nothing edits or deletes lines             | `account.role === "member" && !account.dev` (`errors.ts`)     |
| Backups                                   | No route: kept in R2, restored by hand           | Written by the nightly job only                                                        | `backup.ts`, `docs/runbooks/restore.md`                       |

Notes:

- The dev switch only widens the Error Log (and shows testing tools in the UI). It grants no other API access.
- Owner is unique: the Owner cannot be removed or have their role changed, and only a new setup code (`SETUP_CODE`) recovers the Owner's password without email.
- Calendar Feeds are public to whoever holds the secret address, no session needed; the address is stored only as a SHA-256 hash.

## 2. Private rules

A Private Entry, Task or Occurrence (an Occurrence edited alone to be Private counts) is seen in full by `seesInFull` (`private.ts`): its **creator**, or the **Account of any Person it is for** (a Person-less Private item is therefore seen in full only by its creator). Owner and Admin roles give no extra view.

Everyone else gets, from `forViewer` in `routes/entries.ts` (the same rule is used by Tasks, Export and the `.ics`):

| Kept                                       | Blanked or reset                                               |
| ------------------------------------------ | -------------------------------------------------------------- |
| Time (start, end, all-day), Persons, Repetition, "Private" marker | Title, notes, location                          |
|                                            | Entry Type set to General, importance Normal, no icon, no reminders |

Other places that hide it: the full Export blanks it per viewer (`hidePrivate`); the `.ics` export and Calendar Feeds show "Busy"; Attachments of a hidden item are refused (403 `private`); Reminders, the Briefing and Voice Entry leave out or shorten it as described in `CONTEXT.md`.

A viewer who may not see an item cannot change it: `mayChangeEntry` and `mayChangeTask` return 403 `{"error":"private"}` on these routes:

- Entries: edit, delete, edit or skip one Occurrence, edit or delete "this and following" (`entries.ts`).
- Tasks: edit, tick, untick, delete, move into a Checklist (`tasks.ts`); give a Task items (`checklists.ts`).
- Conversion: Entry to Task, Task to Entry (`convert.ts`).
- Attachments: list, add, open, delete (`attachments.ts`).

Occurrence routes also check a Private Occurrence on that date (or, for "this and following", from it on) with `mayChangeOccurrences`. `routes/private-guard.test.ts` walks every route under `/api/entries/:id` and `/api/tasks/:id`, so a new route that forgets the check fails CI.

## 3. Sessions and sign-in

- **Cookie**: `__Host-session`, random 32-byte token; `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`. Only its SHA-256 hash is stored (`signed_in_device`). Lasts a year from last use; `last_used_at` is refreshed at most hourly and an idle year deletes the device (`auth/session.ts`).
- **Passwords**: at least 10 characters, no complexity rules. PBKDF2-SHA256, 100,000 iterations (the Workers maximum), 16-byte random salt, compared in constant time (`auth/password.ts`). An unknown email is checked against a dummy hash so timing and the `wrong_password` answer match.
- **Throttling**: wrong passwords and wrong setup codes are counted per client IP (5 free) and per target (10 free): the email typed at sign-in, the signed-in Account for password checks, or the setup code (`sign_in_throttle`). After the free attempts, waits double (1, 2, 4 s ... capped at 15 minutes) with 429 `too_many_attempts`; a success clears them. Used by sign-in, setup, Owner reset, password change, Danger zone and leaving Display Mode (`auth/throttle.ts`). Failures aimed at one Account never slow the others.
- **Tokens**: invite (7 days), password recovery (1 hour), email change; 32 random bytes, stored hashed, tied to a purpose (`recovery_token`), redeemed by one atomic `UPDATE ... RETURNING` so two requests can't both use one. "Forgot password" answers 202 at once whatever the email and does the lookup and email afterwards (`waitUntil`), at most a few emails per hour per Account. A new password signs out all that Account's devices and cancels its unused recovery links. Removed Accounts can't sign in or recover.
- **Setup**: first-run setup needs `SETUP_CODE` and only works while no Family exists; changing the code later lets the Owner choose a new password.
- **Same-origin**: any state-changing request without an `Origin` equal to the app's own gets 403 `forbidden_origin` (`security.ts`).
- **Headers**: API and static files send `Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (one constant, `CONTENT_SECURITY_POLICY`; a test checks `_headers` matches), `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` (`security.ts`, `public/_headers`).
- **Images** (`/images/:key`): Signed-in Devices only; only keys registered in the `image` table, only webp, jpeg and png, `nosniff`. The same bucket holds Attachments, which are never reachable through this route. Uploads are capped at 512 KB.
- **Address**: only `calendario.phinest.org`; the workers.dev address is off (`wrangler.jsonc`).
- **Limits** (`limits.ts`, `usage.ts`): titles and names 200 characters, notes 10,000, locations 500 (400 `invalid`). Each Account may make 300 model calls a day (dictation, voice, Suggestions; 429 `too_many_requests`), each device may log 60 errors an hour, and all Attachments together stay under 2 GB (413). Counts live in `usage_count`, kept out of backups and the Export.
- **Attachments**: access follows the owner Entry or Task (Private rules above). Photos and PDFs open inline; every other type is sent as `application/octet-stream` with `Content-Disposition: attachment`, so an HTML file is downloaded, never rendered on the app's origin.

## 4. Decided rules

- An Admin may change an active Account's Person (S4); this stays as it is.
- Members may manage Feeds, Persons, Entry Types and predefined lists (S7/Q2); this stays as it is.
- When the creator gives items to their own Private Task, the result is public (S2).
- There is no extra approval gate on auth or migration PRs (O1).
- Removing an Account is a soft delete that the Owner or an Admin can undo (S13).
- Nightly backups leave out Signed-in Devices (session hashes), throttle, recovery tokens and usage counts (O4); after a restore everyone signs in again.
