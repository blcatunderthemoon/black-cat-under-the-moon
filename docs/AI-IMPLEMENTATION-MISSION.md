# AI Implementation Mission — Product Upgrade & Commercialization

> Mission owner: AI coding agent  
> Source PRD: `docs/PRODUCT-COMMERCIALIZATION-PRD.md`  
> Product: Black Cat Under The Moon  
> Goal: Implement the membership, Mirror Card, legacy match data claim, Inbox, Forum, and Premium foundation without breaking the existing matching and drift bottle systems.

---

## 0. Mission Summary

You are implementing the platform upgrade described in `docs/PRODUCT-COMMERCIALIZATION-PRD.md`.

The most important product decisions are fixed:

1. Do not build real-time chat or WebSocket messaging.
2. Do not create any separate public card product.
3. Mirror Mode's result becomes the only public identity card: **Mirror Card**.
4. Keep existing match questionnaire data in the `responses` table.
5. Link legacy match data to Supabase Auth users through `responses.user_id` after verified Email claim.
6. Use Inbox as the unified private interaction surface.
7. Keep the drift bottle anonymous experience intact; account integration is optional and later-phase.

The mission must be completed conservatively. Do not rewrite the whole application. Keep existing public pages and APIs working while adding the new account-based layer.

---

## 1. Read First

Before coding, read these files:

| File | Why |
|---|---|
| `docs/PRODUCT-COMMERCIALIZATION-PRD.md` | Primary product and technical requirements |
| `docs/SYSTEM-OVERVIEW.md` | Existing drift bottle, matching, Mirror Mode context |
| `docs/MIRROR-MODE-SPEC.md` | Existing Mirror Mode scoring and card data |
| `src/pages/api/submit.js` | Current match questionnaire submission into `responses` |
| `src/pages/api/match.js` | Current matching API using `responses.id` |
| `src/lib/matching.js` | Hard filter logic |
| `src/lib/intelligence.js` | Compatibility scoring |
| `src/lib/content-filter.js` | Existing moderation logic to reuse |

Confirm current behavior before changing it:

- Match questionnaire currently writes to Supabase `responses`.
- Matching currently uses integer `responses.id`.
- Existing `sent_matches` and `blocked_pairs` likely reference `responses.id`.
- Drift bottle APIs should remain anonymous and must not require login in MVP.

---

## 2. Non-Negotiable Rules

### 2.1 Product Rules

- Mirror Card is the only user-facing card.
- `profiles` means account identity, not public card identity.
- `responses` remains the canonical table for match questionnaire answers.
- Legacy response claim must use verified Email as the only automatic claim method.
- IG/TG can be used only as manual review evidence, not automatic linking.
- Free users can receive and reply in allowed contexts, but cannot freely contact arbitrary users.
- Premium users can view Detailed Mirror Card and send monthly limited active letters.

### 2.2 Technical Rules

- Do not break `/api/submit` or `/api/match` for existing unauthenticated usage until replacement flows are live.
- Do not migrate existing `responses.id` to UUID in the first implementation.
- Do not expose other users' Email, raw auth user id, payment info, or complete match questionnaire answers to frontend clients.
- Permission checks must happen server-side, not only by hiding UI buttons.
- Add migration SQL or setup notes; do not rely on manual undocumented dashboard edits.
- Keep implementation small and reversible by phase.

---

## 3. Target Architecture

```text
Supabase Auth user
  ↓
profiles               account identity, subscription tier, status
  ↓
mirror_cards           only public/shareable identity card
  ↓
responses              existing match questionnaire canonical table
  ↓
matching results       still use responses.id during transition
  ↓
inbox_messages         async delivery of match cards and letters
```

Important ID policy:

| Surface | Use ID |
|---|---|
| Auth/account | `profiles.id` / `auth.users.id` UUID |
| Legacy matching | `responses.id` integer |
| Legacy claim | `responses.user_id` UUID links response to profile |
| Inbox recipient | `profiles.id` UUID |
| Match-to-Inbox delivery | convert `responses.id` → `responses.user_id`; only deliver if claimed |

---

## 4. Implementation Phases

### Phase 1 — Auth, Account Profile, Legacy Match Claim, Mirror Card

This is the first and highest priority phase. Complete it before Forum, Inbox, or Premium.

Deliverables:

- Supabase Auth integration.
- Account profile table and helpers.
- `responses` legacy claim migration.
- `legacy_match_claims` audit table.
- Mirror Card table and API.
- Basic pages for login/signup and Mirror Card viewing.

### Phase 2 — Inbox and Match Card Delivery

Deliverables:

- Inbox tables and APIs.
- Convert eligible claimed match results into Inbox match cards.
- No WebSocket; fetch on page load and manual refresh.

### Phase 3 — Forum

Deliverables:

- Forum posts and comments.
- Author Mirror Card teaser.
- Free/Premium post quota.
- Report and moderation hooks.

### Phase 4 — Premium and Billing Foundation

Deliverables:

- Subscription table and server-side permission helper.
- Manual Premium admin flow first.
- Stripe Checkout/Webhook only after manual flow works.

### Phase 5 — Admin and Safety Hardening

Deliverables:

- Legacy claim review screen/API.
- Forum moderation.
- Inbox abuse monitor.
- Audit logs for sensitive admin actions.

---

## 5. Database Mission

Create a SQL migration document or migration script for the following. If the repo has no migration folder yet, create `docs/IMPLEMENTATION-SQL-MIGRATIONS.md` or a clearly named SQL file in a safe project location.

### 5.1 Add Account Tables

Create `profiles`:

| Column | Requirement |
|---|---|
| `id uuid primary key` | matches `auth.users.id` |
| `email text` | internal only |
| `display_name text` | public anonymous display name |
| `avatar_style text` | optional pixel/cat style |
| `bio text` | short account-level bio if needed |
| `status text` | active / limited / suspended / deleted |
| `subscription_tier text` | free / premium |
| `created_at timestamptz` | default now |
| `updated_at timestamptz` | default now |

Create `mirror_cards`:

| Column | Requirement |
|---|---|
| `id uuid primary key` | generated UUID |
| `user_id uuid references profiles(id)` | owner |
| `public_slug text unique` | not guessable |
| `mirror_type text` | solitary / sunny / mystical / sentinel |
| `shadow_type text nullable` | optional |
| `mirror_scores jsonb` | score object |
| `basic_answers jsonb` | Mirror Mode basic data |
| `matching_summary jsonb` | safe display summary only |
| `visibility_settings jsonb` | public/basic/detailed visibility |
| `card_image_url text nullable` | generated image URL if stored |
| `created_at timestamptz` | default now |
| `updated_at timestamptz` | default now |

### 5.2 Extend Existing `responses`

Do not replace `responses`. Add:

| Column | Requirement |
|---|---|
| `user_id uuid nullable references profiles(id)` | account link |
| `normalized_email text nullable` | lower(trim(email)) |
| `claim_status text` | unclaimed / claimed / duplicate / disputed |
| `claimed_at timestamptz nullable` | when linked |
| `archived_at timestamptz nullable` | duplicate/archive marker |
| `source text` | legacy_match_form / logged_in_match_form / admin_import |

Backfill:

```sql
UPDATE responses
SET normalized_email = lower(trim(email))
WHERE email IS NOT NULL;
```

Add useful indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_responses_normalized_email ON responses(normalized_email);
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_claim_status ON responses(claim_status);
```

### 5.3 Add Legacy Claim Audit Table

Create `legacy_match_claims`:

| Column | Requirement |
|---|---|
| `id uuid primary key` | generated UUID |
| `user_id uuid references profiles(id)` | claimant |
| `response_id bigint` | existing response id |
| `claim_method text` | email_exact / admin_manual / contact_review |
| `status text` | pending / approved / rejected / expired |
| `matched_email text nullable` | normalized email match |
| `review_note text nullable` | admin note |
| `created_at timestamptz` | default now |
| `resolved_at timestamptz nullable` | completed time |

### 5.4 Add Inbox Tables

Create `inbox_threads` and `inbox_messages` as described in the PRD. Keep minimal fields for MVP:

- participants / recipient / sender ids use `profiles.id` UUID.
- `message_type`: match_card / user_letter / system.
- `payload jsonb` stores match card snapshot.
- `read_at`, `is_hidden`, `report_count`, timestamps.

### 5.5 Add Premium Tables

Create `subscriptions` and `usage_quotas`. Manual Premium can work before Stripe.

---

## 6. Backend Mission

### 6.1 Auth Helpers

Create reusable server helpers, for example under `src/lib/auth.js` or `src/lib/server-auth.js`:

- `getServerSupabaseClient()`
- `requireUser(req)`
- `getProfile(userId)`
- `ensureProfile(user)`
- `getSubscriptionTier(userId)`
- `isPremium(userId)`

Implementation requirements:

- Use server-side Supabase environment variables.
- Do not trust client-submitted `user_id`.
- Every private API must call `requireUser`.

### 6.2 Update `/api/submit`

Current behavior: inserts into `responses` without auth.

Required behavior:

1. Keep unauthenticated submit working.
2. If request has valid logged-in user, set `responses.user_id` to auth user id.
3. Always set `normalized_email = lower(trim(payload.email))` when email exists.
4. Set `source = logged_in_match_form` for logged-in submissions.
5. Set `source = legacy_match_form` for anonymous submissions.
6. Do not leak auth errors to anonymous users; auth should be optional for this endpoint during transition.

### 6.3 Legacy Match Claim APIs

Implement:

| Endpoint | Behavior |
|---|---|
| `GET /api/match/legacy-claim/status` | Find unclaimed `responses` matching verified auth email. Return count, latest response id, submitted date, claimable boolean. Do not return full answers. |
| `POST /api/match/legacy-claim/request` | Create pending claim record or prepare claim confirmation. For exact verified Email, can immediately mark ready. |
| `POST /api/match/legacy-claim/confirm` | Link latest claimable response to user. Mark duplicates. Insert approved audit row. |
| `POST /api/admin/match/legacy-claim/resolve` | Admin-only manual approve/reject for disputed claims. |

Claim algorithm:

```text
1. require logged-in user
2. require verified email for automatic claim
3. normalized = lower(trim(user.email))
4. find responses where normalized_email = normalized
5. exclude responses with claim_status = claimed by another user
6. choose newest response as active claim target
7. update chosen response: user_id = user.id, claim_status = claimed, claimed_at = now()
8. update older same-email responses: claim_status = duplicate, archived_at = now()
9. insert legacy_match_claims row with status = approved, claim_method = email_exact
```

Security requirements:

- If response is already claimed by another user, do not reveal who claimed it.
- Never auto-claim by IG/TG.
- Log disputed cases.
- Return generic error messages for conflicts.

### 6.4 Mirror Card APIs

Implement:

| Endpoint | Behavior |
|---|---|
| `GET /api/mirror-card/me` | Return current user's card, or empty state. |
| `PATCH /api/mirror-card/me` | Update own card visibility/basic fields. |
| `GET /api/mirror-card/[slug]` | Return Public/Basic/Detailed view based on permissions. |
| `POST /api/mirror-card/image` | Optional in MVP; can be stubbed with clear response if not ready. |

Permission rules:

- Public view: safe Mirror Card fields only.
- Basic view: own card or matched/allowed relationship.
- Detailed view: owner, Premium viewer, or matched allowed relationship.
- Do not return complete `responses` object through Mirror Card API.

### 6.5 Inbox APIs

Implement after legacy claim and Mirror Card basics:

| Endpoint | Behavior |
|---|---|
| `GET /api/inbox/threads` | List current user's threads. |
| `GET /api/inbox/threads/[id]` | Return thread messages if participant. Mark read if appropriate. |
| `POST /api/inbox/send` | Send user letter if permissions and quota allow. |
| `POST /api/inbox/report` | Report message. |
| `POST /api/inbox/block` | Block user. |

No WebSocket. No realtime presence.

### 6.6 Match-to-Inbox Delivery

Add a server function or API that:

1. Takes a match pair based on `responses.id`.
2. Looks up both rows in `responses`.
3. Requires both rows to have `user_id`.
4. Creates `match_card` messages for both users.
5. If one side is unclaimed, store/skip delivery and log reason.

Do not email or expose detailed data inside email. Email should only say there is a new match card.

### 6.7 Forum APIs

Implement after Inbox foundation:

- `GET /api/forum/posts`
- `POST /api/forum/posts`
- `GET /api/forum/posts/[id]`
- `POST /api/forum/posts/[id]/comments`
- `POST /api/forum/report`

Apply content filtering and quotas:

- Free: 1 post/day.
- Premium: 5 posts/day.

### 6.8 Premium Helpers

Implement server-side helpers:

- `assertPremium(userId)`
- `assertQuota(userId, quotaType)`
- `consumeQuota(userId, quotaType)`

Manual Premium MVP:

- Admin can set subscription active until date.
- User's API permissions use subscription table, not frontend state.

---

## 7. Frontend Mission

Build functional UI with existing design language. Keep it restrained, usable, and consistent with current Black Cat / moon / pixel tone.

### 7.1 Required Pages

| Page | Route | Purpose |
|---|---|---|
| Login | `/login` | Email + password login |
| Signup | `/signup` | Email + password registration, display name |
| Mirror Card Mine | `/mirror-card/me` | View/edit/share own Mirror Card |
| Mirror Card Public | `/mirror-card/[slug]` | Public/Basic/Detailed card view |
| Inbox | `/inbox` | Thread list |
| Inbox Thread | `/inbox/[threadId]` | Read/reply async letters |
| Forum | `/forum` | Post list and compose |
| Forum Detail | `/forum/[postId]` | Post + comments |
| Premium | `/premium` | Paywall and benefits |

If the current app structure makes dynamic routes difficult immediately, build the minimum pages that fit the existing Next.js pages setup and document any deferred route.

### 7.2 First Login Flow

Implement this sequence:

```text
login/signup success
  ↓
call /api/match/legacy-claim/status
  ↓
if claimable: show legacy match claim prompt
  ↓
if user confirms: call claim confirm
  ↓
if no Mirror Card: send user to Mirror Mode or mirror card setup
  ↓
show /mirror-card/me
```

Prompt text:

```text
搵到你之前填過嘅配對資料。
認領後可以保留舊配對答案，之後配對卡會直接送入你嘅 Inbox。
```

Buttons:

- 立即認領
- 稍後再處理
- 這不是我的資料

### 7.3 Mirror Card UI

Requirements:

- Reuse current Mirror Mode result data and style direction.
- Do not invent a separate public card layout.
- Display card visibility state: Public / Basic / Detailed.
- Include share URL.
- Include clear privacy toggles for fields.
- Detailed view locked for Free users when target is not allowed.

### 7.4 Inbox UI

Requirements:

- Thread list with unread indicator.
- Message detail with sender Mirror Card teaser.
- Reply form.
- Report and block actions.
- Manual refresh button or page-load fetch.
- No online status, typing indicator, read receipt, or real-time chat design.

### 7.5 Forum UI

Requirements:

- Post list with latest sorting first.
- Compose form for logged-in users.
- Comment form.
- Author display links to Mirror Card.
- Free quota messaging.
- Premium prompt when trying to view Detailed Mirror Card or active letter.

---

## 8. Safety & Privacy Checklist

Before finalizing each feature, verify:

- Other users' Email is never returned to frontend.
- Raw auth user IDs are not shown in UI.
- `responses` full row is never returned through public Mirror Card APIs.
- IG/TG is not exposed by default.
- Legacy claim does not auto-link on IG/TG.
- Inbox send checks block state and quota server-side.
- Forum and Inbox content pass `content-filter`.
- Admin-only APIs are protected.
- Sensitive admin reads are logged or planned for audit.

---

## 9. Suggested File Plan

This is a guide. Adapt to actual codebase patterns.

### Backend / Lib

| File | Purpose |
|---|---|
| `src/lib/server-auth.js` | Supabase server client, requireUser, ensureProfile |
| `src/lib/permissions.js` | Premium, card visibility, quota checks |
| `src/lib/legacy-match-claim.js` | Claim matching and linking logic |
| `src/lib/inbox.js` | Create/list/read messages |
| `src/lib/forum.js` | Forum helpers if needed |

### API

| File | Purpose |
|---|---|
| `src/pages/api/me.js` | Current account state |
| `src/pages/api/match/legacy-claim/status.js` | Claim status |
| `src/pages/api/match/legacy-claim/request.js` | Claim request |
| `src/pages/api/match/legacy-claim/confirm.js` | Claim confirm |
| `src/pages/api/mirror-card/me.js` | Own card |
| `src/pages/api/mirror-card/[slug].js` | Public card lookup |
| `src/pages/api/inbox/threads.js` | Inbox list |
| `src/pages/api/inbox/send.js` | Send letter |
| `src/pages/api/forum/posts.js` | Forum list/create |

### Frontend Pages

| File | Purpose |
|---|---|
| `src/pages/login.js` | Login |
| `src/pages/signup.js` | Signup |
| `src/pages/mirror-card/me.js` | Own Mirror Card |
| `src/pages/mirror-card/[slug].js` | Public card |
| `src/pages/inbox/index.js` | Inbox |
| `src/pages/forum/index.js` | Forum |
| `src/pages/premium.js` | Paywall |

### Documentation / SQL

| File | Purpose |
|---|---|
| `docs/IMPLEMENTATION-SQL-MIGRATIONS.md` | SQL to run in Supabase |
| `docs/IMPLEMENTATION-CHECKLIST.md` | Optional running checklist |

---

## 10. Detailed Execution Checklist

### Step 1 — Baseline Check

- Run syntax check if available.
- Identify current Supabase env var names.
- Confirm current `responses` fields from `/api/submit`.
- Confirm current match API still works before edits.

### Step 2 — SQL/Migration Draft

- Write migration for `profiles`.
- Write migration for `mirror_cards`.
- Alter `responses` with claim fields.
- Backfill `normalized_email`.
- Write `legacy_match_claims` table.
- Write Inbox tables.
- Write subscription/quota tables.
- Add RLS notes or policies.

### Step 3 — Auth Foundation

- Add Supabase server auth helper.
- Implement `/api/me`.
- Create profile on signup/login if missing.
- Build login/signup pages.
- Verify unauthenticated private API returns 401.

### Step 4 — Legacy Claim

- Implement claim status API.
- Implement confirm API.
- Update `/api/submit` to set `normalized_email`, `source`, optional `user_id`.
- Add onboarding prompt after login.
- Test exact Email claim.
- Test duplicate same Email responses.
- Test IG/TG-only response does not auto-claim.

### Step 5 — Mirror Card

- Save Mirror Mode output to `mirror_cards` for logged-in users.
- Build `/mirror-card/me`.
- Build public slug lookup.
- Implement Public/Basic/Detailed response shaping.
- Add paywall response for locked detailed card.

### Step 6 — Inbox MVP

- Create inbox list API.
- Create thread detail API.
- Create send API.
- Create match_card message helper.
- Build Inbox UI.
- Verify no real-time features.

### Step 7 — Matching Integration

- Keep `/api/match` using `responses.id`.
- Add helper to deliver match cards only when both sides have `responses.user_id`.
- Skip or queue unclaimed partner delivery.
- Ensure email notification, if added, contains no sensitive match details.

### Step 8 — Forum MVP

- Create post/comment tables if not already done.
- Implement list/create post.
- Implement comments.
- Link author to Mirror Card.
- Enforce Free/Premium daily post quota server-side.

### Step 9 — Premium MVP

- Implement subscription status API.
- Implement manual admin activation.
- Enforce Detailed Mirror Card and active letter permissions.
- Track monthly active letter quota.

### Step 10 — Admin/Safety

- Add legacy claim review endpoint or dashboard hook.
- Add report endpoints for Forum and Inbox.
- Add block logic to Inbox send.
- Ensure content filtering is applied.

---

## 11. Acceptance Criteria

### Phase 1 Acceptance

- A new user can sign up and log in.
- A `profiles` row exists for the user.
- Logged-in user can create/view a Mirror Card.
- Old `responses` data can be claimed by verified same Email.
- `responses.user_id` is set after claim.
- Same Email duplicate responses are not all active.
- IG/TG-only matches do not auto-claim.
- Public Mirror Card never exposes Email.

### Phase 2 Acceptance

- Inbox lists only current user's messages.
- Match card can be delivered to claimed users.
- Unclaimed match partner does not receive Inbox delivery until claimed.
- User can read and reply asynchronously.
- No WebSocket or real-time chat behavior exists.

### Phase 3 Acceptance

- Forum list and detail work.
- Logged-in users can post/comment.
- Free/Premium quota enforced server-side.
- Author links open Mirror Card view.

### Phase 4 Acceptance

- Premium status is stored server-side.
- Premium can view Detailed Mirror Card.
- Free user receives locked/paywall response for disallowed detailed view.
- Premium active letters are limited monthly.

---

## 12. Test Plan

Manual tests:

1. Anonymous match submit still works.
2. Logged-in match submit writes `responses.user_id`.
3. User signs up with Email matching old `responses.email`; claim prompt appears.
4. User claims old response; `responses.user_id` and `legacy_match_claims` update.
5. User signs up with Email not in `responses`; no claim prompt.
6. Response with matching IG/TG but different Email does not auto-claim.
7. Public Mirror Card hides Email and sensitive match answers.
8. Detailed Mirror Card is blocked for Free when not allowed.
9. Inbox thread cannot be read by non-participant.
10. Blocked user cannot send Inbox message.
11. Free user cannot exceed daily Forum post quota.
12. Premium user can use higher Forum quota.

Automated tests if feasible:

- Unit test claim selection logic.
- Unit test card visibility shaping.
- Unit test quota helper.
- API tests for 401/403 cases.

---

## 13. Rollback & Safety Plan

- Keep old `responses` columns intact.
- Add new nullable columns first; do not make `responses.user_id` required.
- Do not delete legacy rows.
- Keep `/api/match?userId=<responses.id>` behavior until new matching surfaces are fully migrated.
- If claim bugs occur, disable claim prompt and leave existing matching untouched.
- All claim actions should be auditable through `legacy_match_claims`.

---

## 14. Do Not Do

- Do not build a separate public card.
- Do not rename `responses` in MVP.
- Do not convert `responses.id` to UUID in MVP.
- Do not require drift bottle login.
- Do not expose IG/TG by default.
- Do not auto-link accounts by IG/TG.
- Do not add WebSocket chat.
- Do not implement read receipts, online status, or typing indicators.
- Do not put full match questionnaire answers into public Mirror Card payloads.

---

## 15. Final Delivery Notes For The AI Agent

When finishing each phase, report:

- Files changed.
- SQL/migration steps required.
- New environment variables required.
- What was verified.
- What remains deferred.
- Any security risk or manual Supabase dashboard step.

If blocked by missing Supabase credentials or schema visibility, do not guess destructively. Create the SQL/migration document and implement code paths defensively with clear errors.

The north star is continuity: existing users who filled match forms should not lose their data, and new login users should feel that the site remembers them safely once they verify Email.
