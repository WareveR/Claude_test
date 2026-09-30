# Family Calendar

A personal web calendar where one family plans its shared life: birthdays, holidays, events and appointments, viewed by day, week, month or year and filtered by who is involved.

## Language

**Family**:
The single account that signs in and owns every piece of data in the calendar; each installation serves exactly one Family.
_Avoid_: User, account, household, tenant

**Person**:
A member of a Family who can be attached to calendar entries and used as a filter; a Person never signs in. A Person has a name, a colour, an optional photo and an optional date of birth, which keeps a Birthday Entry in sync. Removing a Person archives them (gone from pickers and filters, kept on past Entries); only a Person no Entry mentions can be deleted.
_Avoid_: User, member, participant

**Entry**:
Anything the Family puts on the calendar at a date or time: a birthday, a holiday, an appointment, a class, an outing. Every Entry has exactly one Entry Type.
_Avoid_: Event (a kind of Entry, not the general term), item, appointment

**Entry Type**:
A Family-configurable template that pre-fills new Entries: a name, a colour, an icon or thumbnail image, and defaults for the optional features (repetition, Importance, location, Persons, notes, time of day). It only sets defaults; any Entry may use any feature. Some come built in; Birthday and General are built in and cannot be removed. General is the catch-all that receives the Entries of a deleted Entry Type.
_Avoid_: Category, kind, typology, tag

**Importance**:
How prominent an Entry is in the views: Low, Normal or High.
_Avoid_: Priority, urgency

**Timed Entry**:
An Entry with a start time and an optional end time, read in the Family Time Zone; it may span several days (a trip from Friday 18:00 to Sunday 20:00). Without an end it shows as a moment at its start.
_Avoid_: Event, appointment (both are Entry Types)

**All-day Entry**:
An Entry covering one or more whole days with no clock times; a range includes both its first and last day ("1 to 15 August" covers the 15th).
_Avoid_: Full-day, date-only

**Family Time Zone**:
The single time zone the whole Family's clock times are read in. Entries have no zone of their own, and a Timed Entry keeps its clock time if the Family Time Zone changes.
_Avoid_: Local time, user time zone

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
The selection of Persons the views are narrowed to. It shows Entries for any selected Person, plus Family-wide Entries unless those are switched off, and each device remembers its last selection.
_Avoid_: View filter, member filter

**Birthday Entry**:
An Entry of the built-in Birthday type. It is either synced from a Person's date of birth (attached to that Person; its date and Person change only on the Person) or entered by hand for someone outside the Family. The birth year is optional; when known, the age reached is shown. A birthday party is a separate, ordinary Entry.
_Avoid_: Anniversary, birthdate entry

**Family Password**:
The single secret that signs any device in as the Family: at least 10 characters, no complexity rules. It is recovered through the Family's one registered recovery email, or, as a last resort, through a new setup code in the hosting settings.
_Avoid_: Login, account password, PIN

**Signed-in Device**:
A browser or device holding a Family session that lasts a year from its last use. Each one is listed and can be signed out on its own; changing the Family Password signs out all of them. Every Signed-in Device can edit.
_Avoid_: Session, user, client
