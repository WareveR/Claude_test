# An Account per adult instead of one Family Password

Supersedes [ADR-0003](0003-one-family-password-with-setup-code.md).

With one shared Family Password every device saw everything, so an adult could not keep a Private Entry from the rest of the Family. The owner asked (2026-10-19) for each adult to sign in on their own, with children still never signing in, and agreed the design in "Calendário: contas por pessoa".

So each adult has an Account: email and password, one Person, a role (Owner, Admin or Member) and a Dev switch. The Family Password is gone; a Signed-in Device belongs to one Account, and recovery and notice emails go to that Account's email. The setup screen and its one-time code stay: setup creates the Family and its Owner, and a new setup code still lets the Owner choose a new password. Migration 0035 turned the Family Password and recovery email into the Owner's Account (so the owner signs in with that email and the password already in use) and signed every device out once; the old `family` columns stay, emptied, since migrations are additive. Inviting Members, Private items seen only by their creator and their Persons, a password to leave Display Mode and relations between Persons come in later changes. A single app environment stays: Dev, not a separate test copy, decides who sees the test tools.
