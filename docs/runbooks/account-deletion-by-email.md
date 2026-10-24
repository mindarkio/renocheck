# Runbook: delete an account from an email request

While quote analysis or login is closed, the disclaimer, the login page and the account page tell people to email hello@renocheck.homes to delete an account. Aaron accepted this procedure on 2026-10-24 (DEC-0013).

## When to act

Act only on a request sent from the account's registered email address.

## Before deleting

Reply to that registered address and wait for confirmation from it before deleting.

## Deleting

Delete the user in Supabase Auth (production project, by an owner). The `user_id ON DELETE CASCADE` foreign keys remove that account's quote analyses and claims. Reply to confirm once it is done.

## Afterwards

Do not keep the request thread longer than needed to show the deletion was done. Record no email address in the repo or in tickets.
