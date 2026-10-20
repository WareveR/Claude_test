# Family Calendar

A personal web calendar where one family plans its shared life: birthdays, holidays, events and appointments, viewed by day, week, month or year and filtered by who is involved.

## Language

**Family**:
The single account that signs in and owns every piece of data in the calendar; each installation serves exactly one Family.
_Avoid_: User, account, household, tenant

**Person**:
A member of a Family who can be attached to calendar entries and used as a filter; a Person never signs in. A Person has a name, a colour, an optional photo, optional Nicknames and an optional date of birth, which keeps a Birthday Entry in sync. Removing a Person archives them (gone from pickers and filters, kept on past Entries); only a Person no Entry mentions can be deleted.
_Avoid_: User, member, participant

**Nickname**:
Another name a Person answers to in a Voice Entry, such as "Mum", "my wife" or "Di". A Person may have several; they are never shown in the views.
_Avoid_: Alias, label

**Entry**:
Anything the Family puts on the calendar at a date or time: a birthday, a holiday, an appointment, a class, an outing. Every Entry has exactly one Entry Type.
_Avoid_: Event (a kind of Entry, not the general term), item, appointment

**New**:
The one way to add an Entry or a Task: its form opens as one or the other (from the calendar as an Entry, from the Tasks view as a Task) and the other can be picked at its top, keeping what was already filled in. Until then, moving on from the title picks the kind the title suggests: a clock time means an Entry, a title starting with something to do ("Comprar pão", "Pay the rent") a Task. Both stay separate underneath. An existing Entry can also be turned into a Task and a Task into an Entry, keeping what both have (title, notes, Persons, Private, Importance, Repetition): an Entry's location joins the notes and a repeating one is due on its next Occurrence, while its Entry Type, icon, end, Reminders and edited Occurrences go, and its Preparation stays unlinked; a Task lands on its due date (at its due time, or all day; today without one) as a General Entry; a Task with items becomes an Entry over its period and the list stays as that Entry's Preparation. A Checklist's item and a synced Birthday can't be turned.
_Avoid_: Create menu, add item

**Entry Type**:
A Family-configurable template that pre-fills new Entries: a name, a colour, an icon or thumbnail image, and defaults for the optional features (repetition, Importance, location, Persons, notes, time of day). It only sets defaults; any Entry may use any feature. Some come built in; Birthday and General are built in and cannot be removed. General is the catch-all that receives the Entries of a deleted Entry Type.
_Avoid_: Category, kind, typology, tag

**Importance**:
How prominent an Entry is in the views: Low, Normal or High.
_Avoid_: Priority, urgency

**Private**:
A switch on an Entry or Task for things not everyone should see, such as a medical appointment. It is seen in full by whoever made it and by the Accounts of the Persons it is for; every other Account sees only "Private", its time and its Persons, and can't open, change, tick or delete it, nor find it by voice, and its Export blanks it. Even those who may see it get only "Private" and its time in Display Mode; the Calendar Feed shows it as "Busy", its Reminders say only the time ("Reminder at 10:00"), and it is left out of the Briefing.
_Avoid_: Hidden, secret, confidential

**Timed Entry**:
An Entry with a start time and an optional end time, read in the Family Time Zone; it may span several days (a trip from Friday 18:00 to Sunday 20:00). Without an end it shows as a moment at its start.
_Avoid_: Event, appointment (both are Entry Types)

**All-day Entry**:
An Entry covering one or more whole days with no clock times; a range includes both its first and last day ("1 to 15 August" covers the 15th).
_Avoid_: Full-day, date-only

**Family Time Zone**:
The single time zone the whole Family's clock times are read in. Entries have no zone of their own, and a Timed Entry keeps its clock time if the Family Time Zone changes.
_Avoid_: Local time, user time zone

**Sleeping Hours**:
The whole hours the Family is usually asleep (23:00 to 07:00 unless changed in Settings › Family), wrapping midnight. The day and week views show them half as high and shaded; an hour row with a Timed Entry on any shown day is back at full height, and the views open at the wake-up hour, or just above the earliest Sleeping Hour with an Entry. Entries can still be put in them.
_Avoid_: Night mode, quiet hours

**Family Language**:
The language chosen at setup (pt-PT or English in v1) that every email the app sends is written in. Each device may show the app in another supported language; a new device starts in its browser's language when supported, otherwise the Family Language. Date formats, first day of the week and clock follow the language shown, except the year view, which always runs Saturday to Sunday so every year has the same 37-column shape.
_Avoid_: Locale, default language, user language

**Repetition**:
The rule that makes an Entry repeat: daily, weekly, monthly or yearly, every N of them, optionally on several weekdays, ending never, on a date or after a number of times. A date missing from a month (the 31st, 29 February) falls on that month's last day.
_Avoid_: Recurrence, series, rule

**Occurrence**:
One date or time a repeating Entry falls on. An Occurrence can be skipped or edited on its own; edits and deletions apply to this Occurrence, this and the following ones, or all of them.
_Avoid_: Instance, event

**Family-wide Entry**:
An Entry with no Persons attached: it is for the whole Family. There is no separate "everyone" marker.
_Avoid_: Shared entry, general entry (General is an Entry Type)

**Person Filter**:
The selection of Persons the views are narrowed to. It shows Entries and Tasks for any selected Person, plus Family-wide ones (no Persons) unless those are switched off, and each device remembers its last selection. The same panel lets a device hide Public Holidays.
_Avoid_: View filter, member filter

**Birthday Entry**:
An Entry of the built-in Birthday type. It is either synced from a Person's date of birth (attached to that Person; its date and Person change only on the Person) or entered by hand for someone outside the Family. The birth year is optional; when known, the age reached is shown. A birthday party is a separate, ordinary Entry.
_Avoid_: Anniversary, birthdate entry

**Account**:
How one adult signs in: their own email and password (at least 10 characters, no complexity rules), belonging to one Person. A Person without one, like a child, never signs in. Each Account has a role: the **Owner** (whoever set up the Family; exactly one, the only one who can use the Danger zone), an **Admin** or a **Member**; and a **Dev** switch that shows the tools for testing and diagnosing the app. A forgotten password is recovered by a link sent to the Account's email; the Owner's last resort is a new setup code in the hosting settings. It replaced the Family Password (ADR-0009).
_Avoid_: User, login, profile, Family Password

**Invite**:
How a new adult gets an Account: the Owner or an Admin types their email, and optionally their Person, role and Dev, in Settings › Family › Members; a single-use link valid for 7 days goes to that email, where they choose their password and are signed in. Until then the Account is pending and cannot sign in. The Owner and Admins also send a member a new-password link, change roles, Dev and Persons, and remove Accounts (whose devices are signed out; what they made stays), but never change the Owner's Account or another adult's email. Only the Owner hands the Family to another adult, becoming an Admin. Family-wide settings (Public Holidays, bins, Sleeping Hours) and the Error Log are for the Owner and Admins; the Error Log also for anyone with Dev.
_Avoid_: Sign-up, registration

**Signed-in Device**:
A browser or device signed in to one Account, holding a session that lasts a year from its last use. Each one is listed and can be signed out on its own: a Member sees their own devices, the Owner and Admins see everyone's. Changing an Account's password signs out all of that Account's devices. A device that is signed out, or finds it has been, deletes its offline copy of the calendar at once.
_Avoid_: Session, user, client

**Display Mode**:
A per-device setting for a screen used as a wall display (typically a tablet): the screen stays awake, text is larger, the view returns to today after a few minutes without touch and rolls over at midnight, editing controls are hidden except ticking a Task done, and Private Entries and Tasks show only as "Private". Display Mode is entered from the "Wall" tab of the view switcher and left with the Wall switch in the header, which asks the password of the Account the device is signed in with, so a child at a wall tablet can't reach everything that Account sees; it is not a separate access level.
_Avoid_: Kiosk, read-only mode, wall mode

**Task**:
Something to get done, separate from an Entry: a title, optional notes, an optional due date (with an optional time), any number of Persons (none = the whole Family) and a done state that any device can tick or undo. It has no Entry Type or Importance. A repeating Task follows a Repetition; ticking it brings up the next one, and only the oldest undone one shows. A Task is overdue once its due day ends (or its due time passes) in the Family Time Zone. Dated Tasks appear on their due day in the calendar views. A loose Task may prepare for one Entry, like a Checklist, and shows in that Entry's Preparation. A Task may belong to one Checklist, as one of its items: then it is only a title, a done state, optional Persons and a short note, may hold items of its own, never shows on its own and has no due date, notes, Private or Reminder of its own.
_Avoid_: To-do, chore, reminder

**Checklist**:
A named group of simple Tasks (its items: a title, a done state, optional Persons, and an optional short note such as "Aldi" or "still to buy"; an item may hold items of its own, at any depth, and is done when all of them are) done together, such as the summer cleaning, back to school or holiday packing, showing its progress ("3 of 8 done"). Its start and end are each optional: before the start it is not pending, and at the end its undone items become overdue, so an end alone is a deadline. Its Persons are only the default for new items, and the Person Filter shows it when any of its items matches. A Checklist comes back as a new round, all items undone, either by a Repetition or by "Use again"; the previous round closes with only its result kept ("2025: 7 of 8"), even if unfinished. The Repetition says when each round starts ("every Sunday"), counted from the start, or from the day it was saved without one; a round lasts until the end (keeping that length each round) or, without an end, only its first day. Its items repeat only with the Checklist, and adding, renaming or removing one applies to every future round. It reminds once at the start of each round unless switched off. It may prepare for one Entry, such as a party or a trip: an Entry's page shows its Preparation, the Checklists and loose Tasks linked to it, each Checklist with its progress and each Task to tick, and can make a new one there (a new Checklist is named after the Entry and ends on its first day) or link an existing one; deleting the Entry only unlinks them. It shows as an all-day bar in the calendar views: from start to end, on its only date when it has just one, or on each round's days when it repeats. Selecting it anywhere opens its page, where its items are listed as a tree (an item such as "Food and drinks" holding its own items shows how many are done and opens and closes like an accordion, a finished one starting closed; ticking it ticks everything inside) and every item can be ticked, added at any level, also from a predefined list, edited, moved inside another or removed (also by swiping it sideways, with an Undo). A loose Task dragged onto a Checklist in the Tasks view, or added from its form, either moves in as an item (losing its date, time, Repetition and Private) or leaves a copy there with the same title and Persons.
_Avoid_: Task list, project, template, group

**Checklist template**:
A Family-wide name and ordered list of item names to start a new Checklist from; choosing one fills in the name and creates its items when the Checklist is saved. The app comes with built-in ones (summer cleaning, decluttering, shopping, back to school, holiday packing) that show in each device's language until edited; any Checklist can be saved as a new one. Templates can be created, edited, deleted, and "Restore defaults" brings back the built-in ones as they came, leaving the Family's own alone. A template is never a Checklist: changing it doesn't change Checklists made from it.
_Avoid_: Preset, model, recurring list

**Tasks view**:
The view listing Tasks in four groups (Overdue, Today, Upcoming, No date), with done Tasks behind a "Show done" switch. A Checklist shows as one row with its progress in the group of its round's end, opening its page; its items never show on their own. The Person Filter applies to it as to the calendar views.
_Avoid_: To-do list, task list

**Shopping List**:
The Family's one list of things to buy, on its own page next to the Tasks view; it has no dates and never shows on the calendar. An item is a name with an optional quantity ("2", "1 kg"), note and shop (none means any shop), and goes under a section of the shop (Fruit and veg, Meat and fish, Dairy and eggs…, Other) worked out from its name. Items are added one at a time from a single box that suggests the names of earlier lists, most often added first; picking one brings back its last shop. The page can be narrowed to one shop (its items plus those for any shop), remembered per device. Tapping an item ticks it bought, with an Undo, and tapping again puts it back; a bought item leaves the list the next day in the Family Time Zone but stays in the history that feeds the suggestions. Removing an item (its bin button, or a sideways swipe, with an Undo) deletes it for good. A shopping trip's Entry (its title says "Compras", "Supermercado", "Groceries"…) gets no Preparation list of its own: its summary and page show the open items, only to read, with a link to the list; when its title names a shop the items are tagged with ("Compras no Lidl"), only that shop's items and those for any shop, and the link opens the list narrowed to it.
_Avoid_: Groceries, shopping Checklist (a Checklist has rounds and dates), basket

**Weather Location**:
A place saved for the weather forecast by searching a town name; the Family keeps up to 10. Exactly one is selected at a time for the whole Family, and switching it on any device switches it everywhere. With none saved, no weather is shown.
_Avoid_: Home location, city, weather city

**Reminder**:
A phone notification sent a set time before an Entry or one of its Occurrences ("1 day before", "1 hour before"); an Entry has zero or more, defaulted by its Entry Type. All-day Entries remind at 09:00 in the Family Time Zone; a dated Task reminds at its due time, or 09:00 on its due day; a Checklist reminds at 09:00 on the first day of each round, and its items never remind on their own. The notification shows the title and time, never the notes (only the time for a Private one). Each Signed-in Device chooses which Persons it is reminded about, or switches Reminders off; a wall tablet's are set in its own Settings like any device.
_Avoid_: Alert, alarm, notification (the delivery, not the setting)

**Calendar Feed**:
A read-only, secret .ics link covering chosen Persons that other calendar apps subscribe to. It can be revoked and replaced; it never takes changes back. Private Entries appear in it only as "Busy".
_Avoid_: Sync, export, subscription

**Public Holiday**:
A holiday the app calculates for the countries, regions and municipality chosen in the Family settings (Portugal's national holidays by default). It shows as a label on its day in each device's language, with the date lightly shaded. It is not an Entry: it can't be edited, sends no Reminders, and each device can hide Public Holidays.
_Avoid_: Bank holiday, feriado, holiday Entry

**Voice Entry**:
Creating or changing an Entry or Task with one sentence, spoken or typed, from the same microphone button. The browser turns speech into text, and a Workers AI model works out what is meant. A change may touch anything the Entry or Task form can ("Task X is done", "dinner moves to next Friday", "make it every two weeks"), but never deletes. It finds the Entry or Task among those from 7 days ago to 90 days ahead plus undated and overdue Tasks; when several match it asks which, and when none does it changes nothing. One sentence changes one Entry or Task, though it may change several of its details. For a repeating Entry it asks "only this time or from now on?" unless the sentence says, and a change to the Repetition itself applies from now on. The app then shows a short summary with Save and Edit. When the sentence was spoken, it also reads the summary aloud and listens: "yes" saves at once, with an Undo for a few seconds, "no" or "edit" opens the filled-in form, and silence or an unclear answer leaves the summary up. Each device can switch the spoken readback off; the summary then waits quietly for Save or Edit. Voice Entry is not offered in Display Mode.
_Avoid_: Voice command, dictation, assistant, chat

**Suggestions**:
The page, opened from the light-bulb button in the header, where the Family fills in what repeats in its life in one go. A phrase written or said in its box ("gym on Monday and Wednesday at 7pm") is read by a Workers AI model into a repeating Task or Entry, and a topic the catalogue doesn't have ("baby") into several; a theme word ("car", "the dog") opens that area of the built-in catalogue of ideas (car, home, monthly bills, paperwork, health, school, pets, weekly routine), which works out dates such as the IUC, the car inspection and the IMI from a few answers. A bill paid by hand is a Task; one paid by direct debit is an all-day notice. An idea that is each Person's own (a gym, a dentist, an ID card, a school year) asks who it is for, and each Person picked gets a line of their own, since their days and dates differ; the others are Family-wide. Everything is reviewed in one list, where each first date, time, Repetition and Persons can be changed, and a line can be copied for another Person ("Also for…") to give them their own day and time; several Persons on one line make one Entry or Task for them together. It is all created at once with an Undo; nothing is saved before. The model sees the phrases and the Persons' names and nicknames, so a phrase naming someone ("Dad's gym on Monday at 7pm") comes for that Person, and one giving each Person their own times comes as a line each. Not offered in Display Mode.
_Avoid_: Onboarding, wizard, recommendations

**Briefing**:
A few sentences in natural language, at the top of the "Coming up" panel (together with today's and overdue Tasks) in the side panel of every calendar view and of Display Mode, saying what is coming up and what deserves attention: "Tomorrow Diana has Scouts, Mum's birthday is next week, and Christmas is a month away, a good time to start thinking about presents." A Workers AI model picks three to five things worth mentioning from the next 60 days of Entries, Tasks, Checklists, Birthdays and Public Holidays, favouring High Importance and what is closest, and may add a suggestion or question. The model sees titles, dates and Persons' names, never notes or Private Entries and Tasks. There is one Briefing for the Family and one for each Person, in each language in use: with exactly one Person in the Person Filter that Person's Briefing shows, otherwise the Family's. It is written once a day before dawn, rewritten when something in the next 7 days changes, and has a Refresh button. When the model fails, a plain countdown list of the same things shows instead.
_Avoid_: Summary, digest, home page, dashboard

**Error Log**:
The record of everything that went wrong in the app, on the server or on a device, kept for 90 days and readable in Settings on any Signed-in Device except in Display Mode. When something fails, the device shows at once what failed and what to try, with a short error code that points to its Error Log line; the details show the action, time, app version and technical message. Reporting an error adds an optional comment to its line and emails the Family's recovery address straight away; on days with errors, a summary email is also sent. An error that happens offline is kept on the device and logged when it is back online. The Error Log never holds notes or the titles of Private Entries and Tasks.
_Avoid_: Crash log, bug report, error history

**Backup**:
A copy of the Family's data kept so it can be brought back after a mistake or a loss, since deleting is final and nothing keeps a history. Every night a full copy is saved; the last 30 nightly copies and one per month for 12 months are kept. Images are never overwritten, and one no longer used is removed only 30 days later, so a restored copy still finds its images. Restoring brings back the whole calendar as it was at that moment, losing what changed since; it is done by hand by whoever runs the installation, never from the app. A Backup that fails is logged in the Error Log.
_Avoid_: Snapshot, archive, history

**Export**:
A file the Family downloads from Settings to keep its data outside the app: either everything (all data and images) or all Entries as an .ics calendar file. It holds everything the Family sees, Private Entries and Tasks, archived Persons and closed Checklist rounds included, but never a password, secrets, Signed-in Devices or the Error Log. Settings shows when the last full Export was downloaded. A full Export can be used to restore, the same way as a Backup; the app has no import.
_Avoid_: Download, dump, Calendar Feed (a live link, not a file)

**Danger zone**:
The last part of Settings › Account, only for the Owner, where the Family deletes data for good: any of Entries, Tasks and Checklists, the Shopping List, Persons (with their nicknames and synced Birthdays; their Entries and Tasks stay, Family-wide), Entry Types (those made by the Family go, their Entries moving to General, and the built-in ones are reset), Checklist templates (reset to the built-in ones), Family settings (Public Holiday places, bins, Weather Locations, Sleeping Hours, Calendar Feeds) and the Error Log; or all of them, to start again as a new Family. Deleting Entries keeps the synced Birthdays of Persons who stay. The Accounts, the Family's name, language and time zone, and the Signed-in Devices always stay. The Owner's password is asked first, then the device downloads a full Export, and the server saves a full copy beside the Backups, restored by hand like them, before deleting. Not offered in Display Mode.
_Avoid_: Reset, wipe, factory reset
