# Checklist items have a short note and a section

ADR 0006 made a Checklist's items only a title, a done state and optional Persons. The owner's family plans parties and trips on paper lists split into headings ("To do", "Food and drinks", "To bring", "Games", "Shopping") with a few words beside each item ("Aldi", "still to buy", "pick up on Saturday"), and asked for those lists in the app.

So an item now also has an optional short note and an optional section. The note is the Task's existing `notes` column, which items already carried but the app ignored; it shows under the item's title on the Checklist's page. The section is a new `section` text column on `task` (default empty, additive migration), set only for items: the page lists items under their sections, each section placed where its first item was added and showing its own progress, with items without a section first. A section exists only while it has items; there is no separate section table to keep in step.

Everything else in ADR 0006 stands: items still have no dates, times, Reminders or Private, never show on their own, and repeat only with their Checklist. Templates still keep item names only.
