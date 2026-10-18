# Demo account

For local and staging demos only. Never reuse these values for a real senior, and change the PIN before any real data is entered.

| Field | Value |
| --- | --- |
| Senior ID | `SC-2024-0001` |
| PIN | `123456` |
| Name | Maria Santos |

The app derives an internal address from the Senior ID. It is never shown and never receives mail:

```
sc-2024-0001@seniors.agakai.local
```

## Create it once

The account must exist in Supabase Auth; the profile row is created by a trigger.

1. Supabase Dashboard → **Authentication → Users → Add user**.
2. Email: `sc-2024-0001@seniors.agakai.local`
3. Password: `123456`
4. User metadata (JSON):

```json
{
  "senior_id": "sc-2024-0001",
  "name": "Maria Santos",
  "birthday": "Mar 14, 1958",
  "gender": "Female",
  "address": "Barangay Gun-ob, Lapu-Lapu City",
  "mobile_no": "0917 123 4567"
}
```

5. Leave "Auto Confirm User" enabled, then save.
6. Authentication → Sign In / Providers → Email: **disable new user sign-ups** so nobody can create accounts themselves.

The trigger links the new auth user to the existing `sc-2024-0001` profile row. If the row was already claimed, the trigger leaves it alone, so a second account cannot take it over.

## Verify

Sign in with `SC-2024-0001` / `123456`. Expected: one profile, memory empty on first login.

If sign-in fails, check the profile link:

```sql
select id, senior_id, auth_user_id from public."user" where senior_id = 'sc-2024-0001';
```

`auth_user_id` must match the id shown for that user in Authentication → Users.
