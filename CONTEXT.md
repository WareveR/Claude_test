# Family Calendar

A personal web calendar where one family plans its shared life: birthdays, holidays, events and appointments, viewed by day, week, month or year and filtered by who is involved.

## Language

**Family**:
The single account that signs in and owns every piece of data in the calendar; each installation serves exactly one Family.
_Avoid_: User, account, household, tenant

**Person**:
A member of a Family who can be attached to calendar entries and used as a filter; a Person never signs in.
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
