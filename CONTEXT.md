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
A Family-configurable template for Entries: a name, a colour, which optional features its Entries offer (repetition, Importance, location, Persons, notes, time of day) and their defaults. Some come built in; Birthday is built in and cannot be removed.
_Avoid_: Category, kind, typology, tag

**Importance**:
How prominent an Entry is in the views: Low, Normal or High.
_Avoid_: Priority, urgency
