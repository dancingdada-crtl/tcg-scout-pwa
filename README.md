# TCG Scout PWA — V1.3 Supabase-connected build

V1.3 keeps the approved V1.2.1 UI and replaces the local-only prototype data layer with the Supabase launch backend.

## Connected in V1.3

- Supabase magic-link authentication with `shouldCreateUser: false` for invite-only membership.
- Public Viewer mode uses the limited public database views.
- Member/Admin roles come from `profiles.role`; the sole Admin remains controlled in Supabase.
- Shared stores/products and soft archive/restore.
- Shared quick reports with separate event/submission timestamps and independent report indicators.
- Shared Products, price observations, saved Analytics, member profiles, contribution rankings and Admin activity.
- Profile pictures and Admin app branding use Supabase Storage. Images are resized in the browser before upload.
- Confirm/dispute actions are connected to `report_feedback`.
- Realtime refresh for shared member data.
- Existing V1.2.1 mobile store/report full-screen behavior is preserved.

## Required before upload

Edit `supabase-config.js` and paste your Supabase **Project URL** and **Publishable key** (or legacy anon key). Never put the service-role/secret key in this project.

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'YOUR_PUBLISHABLE_KEY';
```

Find both values in Supabase Project Settings/API (the exact dashboard label can vary). The browser key is expected to be public; Row Level Security protects the data.

## GitHub Pages

Upload all files in this folder over the current repository files and commit. The service-worker cache is `tcg-scout-v1-3`, so installed clients should pick up the new app shell after reopening/reloading.

## Invite-only members

Keep **Allow new users to sign up** disabled. Invite new users from Supabase Authentication → Users → Add user → Send invitation. Once the user exists, the V1.3 login form can send them magic links.

## Local V1.2 data

V1.3 reads shared Supabase data after connection. The older localStorage snapshot is retained only as an emergency local backup and is not automatically uploaded to Supabase, which prevents demo/test records from being pushed into the live database.

## Current launch limitation

The in-app Admin member screen can disable/restore existing members, but creating the initial Supabase Auth invitation remains a Dashboard action. Sending Auth invitations directly from the PWA would require a protected server/Edge Function because the service-role key must never be exposed in browser code.
