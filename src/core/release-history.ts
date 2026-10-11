import type { ReleaseKind } from "./release-number";

/**
 * How each change on main before titles told fixes apart counts towards the version number,
 * by its short commit id. "none": planning, documentation or tooling, which doesn't change
 * the app. Later changes go by their title (release-number.ts).
 */
export const RELEASE_HISTORY: Record<string, ReleaseKind> = {
  db5bc12: "none", // Merge pull request #36 from WareveR/claude/project-thread-26qevk
  c042163: "none", // Merge pull request #45 from WareveR/claude/project-thread-til9nm
  "26f6070": "none", // Merge pull request #46 from WareveR/claude/project-thread-1jq8ne
  "9bc52aa": "none", // Merge pull request #47 from WareveR/claude/project-thread-ny13p7
  e372dce: "none", // Merge pull request #48 from WareveR/claude/project-thread-x4zbfc
  dd055d3: "none", // Merge pull request #49 from WareveR/claude/project-thread-uv3i2h
  "7e60eb7": "none", // Merge pull request #50 from WareveR/claude/project-thread-2blxnu
  "38faa56": "none", // Merge pull request #51 from WareveR/claude/project-thread-v8k1zd
  "611ad73": "feature", // Merge pull request #87 from WareveR/claude/project-thread-nsjmnx
  ff14994: "feature", // Merge pull request #88 from WareveR/claude/project-thread-nsjmnx
  "15ae363": "feature", // Merge pull request #89 from WareveR/claude/project-thread-nsjmnx
  ea9c315: "feature", // Merge pull request #90 from WareveR/claude/project-thread-nsjmnx
  "2274917": "none", // Add auto-merge workflow for Claude's PRs
  aeb20a4: "feature", // Merge pull request #91 from WareveR/claude/project-thread-nsjmnx
  d2b1e3e: "feature", // Add Entry Types with built-in defaults and custom types (#60) (#92)
  e5f842d: "feature", // Add one-off Entries and the week view time grid (#61) (#93)
  "4cd767c": "feature", // Add the day and month views (#62) (#94)
  dc84d33: "feature", // Add the year view (#63) (#95)
  b4fde05: "none", // Update auto-merge workflow for Claude PRs
  "5c93e56": "feature", // Add repeating Entries (#64) (#96)
  "9ce01d7": "feature", // Change one Occurrence or the following (#65) (#97)
  c494d20: "feature", // Add Birthdays synced from Persons' dates of birth (#66) (#98)
  f59d1e8: "feature", // Add Tasks and the Tasks view (#67) (#99)
  "8245697": "feature", // Add repeating Tasks (#68) (#100)
  "5aa1029": "feature", // Add the Tasks accordion to the day, week and month views (#69) (#101)
  "97a0078": "feature", // Add Checklists (#70) (#102)
  f8a1c66: "feature", // Add Checklist rounds and period bars (#71) (#103)
  "12830e1": "feature", // Add the Person Filter (#72) (#104)
  dc49157: "feature", // Add Public Holidays (#73) (#105)
  "44c3835": "feature", // Add password recovery and the recovery email (#57) (#106)
  "720f2cb": "feature", // Add error notices, the Error Log and the daily error summary (#58) (#107)
  "5fdf941": "feature", // Add Calendar Feeds (#82) (#108)
  "209b6d1": "feature", // Make the app installable and readable offline (#77) (#109)
  "2c72269": "feature", // Add the weather forecast (#74) (#110)
  "452e361": "feature", // Add the nightly Backup and image cleanup (#84) (#111)
  "455b11b": "none", // Add the restore runbook (#86) (#112)
  "59dcf08": "feature", // Add Export (#85) (#113)
  "193d860": "fix", // Wait for fresh data before filling an edit form (#114)
  da5f7c9: "feature", // Briefing: AI-written band atop today's day view (#75) (#115)
  "39ccebe": "feature", // Briefing per Person, language and rewrites (#76) (#116)
  "354b2f9": "feature", // Reminders for Entries via Web Push (#80) (#117)
  f2607d2: "feature", // Reminders for Tasks and Checklists (#81) (#118)
  "2016a7d": "feature", // Voice Entry: create an Entry or Task from one sentence (#78) (#119)
  e70ee77: "feature", // Voice Entry: change an Entry or Task by one sentence (#79) (#120)
  f97fe2e: "feature", // Display Mode: the wall calendar board (#83) (#121)
  "21c0e58": "none", // Point wrangler at the production D1 database (#53) (#122)
  "9587f2b": "none", // Serve the calendar on calendario.phinest.org (#53) (#123)
  a370539: "feature", // Send emails through Resend when a key is set (#53) (#124)
  e4f2399: "none", // Write down how to deploy and roll back (#53) (#125)
  "7c56876": "none", // Document Email Routing and sending from Gmail through Resend (#126)
  "7e0fdee": "fix", // Open header dialogs over the whole screen (#127)
  "1fe8595": "fix", // Keep Cancel and Save pinned to the bottom of forms (#128)
  e95fe1b: "fix", // Make Display Mode a view entered from the Wall tab (#129)
  "2128871": "fix", // Use the width of wide screens in the day and month views (#130)
  "2743fec": "feature", // Add colour themes chosen per device (#131)
  "31ff173": "feature", // Add a Detail mode to the year view with a line per Person (#132)
  "543c538": "fix", // Split Settings into areas with Sign out always visible (#133)
  "9e03aa0": "feature", // Add optional Calendar Layers chosen in the filter panel (#134)
  ae7f5cb: "none", // auto deploy
  db54f64: "feature", // Add rubbish collection days as a Calendar Layer (#135)
  "3f91fd4": "none", // Document the automatic deploy on every green push to main (#53) (#136)
  aa92b9d: "none", // Wait for the tick to reach the server before reloading in the wall test (#137)
  c9c706b: "fix", // Keep lazily loaded libraries out of the offline copy (#138)
  "89dc0ef": "feature", // Show today's sunrise and sunset on the wall and today's Day view (#139)
  "7aaaf9c": "fix", // Colour the weather icons and show the chance of rain in more places (#140)
  "1244aff": "fix", // Use real buttons for every action and make navigation keep its place (#141)
  "2e44e3c": "fix", // Make hours, days and entries easier to read, above all on big screens (#142)
  d4f2964: "feature", // Show Entries in the year grid and keep its 37 columns in Detail (#143)
  a598c11: "fix", // Open Briefing Entries in a popup and drop its other links (#144)
  "5e0253c": "feature", // Keep each day's last weather reading and show it on past days (#145)
  "0b437e4": "fix", // Pick times of day in 5-minute steps (#146)
  "03c0204": "feature", // Show the weather in detail before opening the forecast site (#147)
  ccd3195: "feature", // Simpler Checklists: independent dates and repetition, plain items, and a Checklist page (#150)
  "45fef45": "feature", // Put \"Coming up\" in a hideable side panel in every view and fix the hourly strip (#149)
  "1254220": "fix", // Pick the hour and the minutes apart, minutes in 5-minute steps (#151)
  "88db26d": "fix", // Modern switches, ticks and chips; sun arc and coloured layer icons (#148)
  "9f94d0f": "feature", // Checklist templates, and dragging Tasks into Checklists (#152)
  "28560e9": "fix", // Give a Checklist's page a Back button (#153)
  "7523033": "feature", // Drag Entries to another day or time in the calendar (#154)
  f5f7574: "fix", // Show the sun on one slim line, the next 24 hours, and small weather readings (#155)
  a41789a: "fix", // Keep the wall readable on phones and tablets (#156)
  "370c0c7": "fix", // Never let a page grow wider than a phone's screen (#157)
  "48ba887": "fix", // Back from an Entry on the wall returns to the week it showed (#158)
  "67d07cc": "fix", // Read the forecast's next days down each column (#159)
  f1bbedf: "fix", // Pause between the readback's summary and its question (#161)
  "88fce11": "feature", // Fill the calendar from a Suggestions page (#162)
  "079d4c5": "fix", // Voice Entry shows a summary first, and the microphone says what it heard (#164)
  "3f5495f": "fix", // Keep the header on one line on phones (#165)
  "1208596": "fix", // Suggestions: keep the review still while editing, mark what was created (#166)
  "4a3d10c": "fix", // Show all seven days on the wall without a sideways scroll (#167)
  ea16e52: "feature", // Settings: show the app version and update it now (#168)
  "0f89ffa": "fix", // Weather detail: next days in one sliding row (#170)
  a87d746: "fix", // Suggestions: the light bulb closes them, back to the view (#171)
  "38ee558": "fix", // Day headers: weekday and date on one line, weather in two lines (#169)
  f7bd023: "feature", // Tasks: importance, date-then-priority order, overdue in a red box (#172)
  b3d7509: "fix", // Compact bars on small and short screens (#163)
  c1f7800: "fix", // Month and year: a picked day opens in a popup with its Entries as an accordion (#173)
  "54c4dbd": "feature", // Agenda view: Entries and Tasks day by day, in date order (#174)
  "7950ffe": "feature", // Checklist items: a short note and sections (#175)
  "65eb28d": "feature", // Link Checklists and Tasks to the Entry they prepare for (#176)
  "5af067f": "fix", // Checklist sections open and close like an accordion (#177)
  f9bb857: "feature", // Search: Entries, Tasks and Checklists by any word, exact text or exclusions (#178)
  "0f92405": "feature", // Number versions like v1.4.2: features raise the middle number, fixes the last (#179)
};

/** The commit after which each major version counts its changes; 0 counts from the start. */
export const MAJOR_STARTS: Record<number, string> = {};
