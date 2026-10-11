# Checklist items nest instead of having sections

Sections (ADR 0007) gave a Checklist one level of grouping. The owner then asked for items that hold items of their own, at any depth, each showing how many of its items are done, and for Tasks and Checklists to become one thing: a Task with items.

So an item may now sit inside another item of the same Checklist (`task.parent_id`, deleting with its parent). An item with items is done exactly when all of them are: ticking it ticks everything inside, and unticking or adding anything inside unticks it. Progress counts only the items that hold none. On the page every item with items shows "3 of 5", opens and closes like an accordion (a finished one starting closed) and has its own + to add inside it, and a predefined list (a template) can be added at any level. Migration 0027 turned each section into an item holding that section's items; the `section` column stays, always empty, since migrations are additive.

The `checklist` table stays as the container for a Task with items, keeping its period, rounds, Persons and Entry link, so voice, the Briefing, reminders and export keep working unchanged. Making "New task" and "New checklist" one form comes next.
