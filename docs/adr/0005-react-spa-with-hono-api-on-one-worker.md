# React single-page app with a Hono API on one Worker

v1 is written in TypeScript as a React single-page app built with Vite, plus a small Hono API. One Cloudflare Worker serves both, so there is one project and one deploy. The phone renders the pages, and the Worker only answers API calls. This keeps each request well inside the free plan's 10 ms CPU limit (ADR-0004) and makes the installable, offline-readable app decided in #5 straightforward.

The supporting choices are:
- **Database:** D1 through Drizzle ORM, with numbered migrations.
- **Dates:** stored as wall-clock values plus the Family Time Zone (ADR-0002). date-fns and its time-zone add-on do the date maths, and the browser's Intl formats dates.
- **Translations:** i18next, with one JSON file per language, shared by the UI and the Worker's emails.
- **Data and refresh:** TanStack Query refreshes every minute and on focus. Its cache is kept on the device so the calendar can be read offline.
- **Installable app:** vite-plugin-pwa.
- **Navigation:** React Router puts the view and date in the address, so the back button and links work.
- **Styling:** Tailwind CSS.
- **Calendar views:** our own code, so extra views can be added later.
- **Voice Entry (#27):** the browser's speech recognition and speech synthesis, plus a small Cloudflare Workers AI model within its free daily allowance to turn a sentence into an Entry or Task. When the model fails, the plain form opens instead.

The owner prefers well-known tools with low upkeep over learning something new. React was chosen over Svelte for its larger ecosystem, at the cost of about 45 KB more to download once. Full-stack server-rendering frameworks were rejected: they spend Worker CPU on every page and complicate offline use. Calendar libraries were rejected because they handle the year view, Person colours and Display Mode poorly or only in paid versions. Temporal was not used because it is not yet in every supported browser.
