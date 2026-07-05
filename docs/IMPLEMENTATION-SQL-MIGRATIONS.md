# SQL Migrations — Black Cat Under The Moon Platform Upgrade

> Run these in Supabase SQL editor in order. Each section is independent but must be applied in sequence.
> All tables use UUID primary keys unless noted (responses.id is an existing integer).

---

## Migration 001 — profiles

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text,
  display_name      text NOT NULL DEFAULT '',
  avatar_style      text,
  bio               text,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','limited','suspended','deleted')),
  subscription_tier text NOT NULL DEFAULT 'free'
                    CHECK (subscription_tier IN ('free','premium')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Public display name visible"
  ON profiles FOR SELECT
  USING (status = 'active');
```

---

## Migration 002 — mirror_cards

```sql
CREATE TABLE IF NOT EXISTS mirror_cards (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  public_slug          text UNIQUE NOT NULL,
  mirror_type          text,
  shadow_type          text,
  mirror_scores        jsonb DEFAULT '{}'::jsonb,
  basic_answers        jsonb DEFAULT '{}'::jsonb,
  matching_summary     jsonb DEFAULT '{}'::jsonb,
  visibility_settings  jsonb DEFAULT '{"public":true,"basic":false,"detailed":false}'::jsonb,
  card_image_url       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_mirror_cards_updated_at
  BEFORE UPDATE ON mirror_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_mirror_cards_user_id ON mirror_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_mirror_cards_public_slug ON mirror_cards(public_slug);

-- RLS
ALTER TABLE mirror_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own card"
  ON mirror_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own card"
  ON mirror_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own card"
  ON mirror_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Public cards visible to all"
  ON mirror_cards FOR SELECT
  USING ((visibility_settings->>'public')::boolean = true);
```

---

## Migration 003 — Extend existing responses table

> IMPORTANT: responses already exists. Only add new columns. Do NOT drop or alter existing columns.

```sql
-- Add claim-related columns
ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS normalized_email text,
  ADD COLUMN IF NOT EXISTS claim_status    text NOT NULL DEFAULT 'unclaimed'
                                           CHECK (claim_status IN ('unclaimed','claimed','duplicate','disputed')),
  ADD COLUMN IF NOT EXISTS claimed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at     timestamptz,
  ADD COLUMN IF NOT EXISTS source          text NOT NULL DEFAULT 'legacy_match_form'
                                           CHECK (source IN ('legacy_match_form','logged_in_match_form','admin_import'));

-- Backfill normalized_email from existing email column
UPDATE responses
  SET normalized_email = lower(trim(email))
  WHERE email IS NOT NULL AND normalized_email IS NULL;

-- Indexes for claim lookup
CREATE INDEX IF NOT EXISTS idx_responses_normalized_email ON responses(normalized_email);
CREATE INDEX IF NOT EXISTS idx_responses_user_id          ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_claim_status     ON responses(claim_status);
```

---

## Migration 004 — legacy_match_claims

```sql
CREATE TABLE IF NOT EXISTS legacy_match_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_id    bigint NOT NULL,
  claim_method   text NOT NULL DEFAULT 'email_exact'
                 CHECK (claim_method IN ('email_exact','admin_manual','contact_review')),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','expired')),
  matched_email  text,
  review_note    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_legacy_claims_user_id     ON legacy_match_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_legacy_claims_response_id ON legacy_match_claims(response_id);
CREATE INDEX IF NOT EXISTS idx_legacy_claims_status      ON legacy_match_claims(status);

-- RLS: Users can see their own claims; admins see all (via service role)
ALTER TABLE legacy_match_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own claims"
  ON legacy_match_claims FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Migration 005 — inbox_threads

```sql
CREATE TABLE IF NOT EXISTS inbox_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_b   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type     text NOT NULL DEFAULT 'direct'
                  CHECK (source_type IN ('match','forum','bottle','direct','system')),
  source_id       uuid,
  last_message_at timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_thread CHECK (participant_a != participant_b)
);

CREATE INDEX IF NOT EXISTS idx_threads_participant_a ON inbox_threads(participant_a);
CREATE INDEX IF NOT EXISTS idx_threads_participant_b ON inbox_threads(participant_b);

-- RLS
ALTER TABLE inbox_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read threads"
  ON inbox_threads FOR SELECT
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);
```

---

## Migration 006 — inbox_messages

```sql
CREATE TABLE IF NOT EXISTS inbox_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
  sender_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_type  text NOT NULL DEFAULT 'user_letter'
                CHECK (message_type IN ('user_letter','match_card','system')),
  content       text NOT NULL DEFAULT '',
  payload       jsonb DEFAULT '{}'::jsonb,
  read_at       timestamptz,
  report_count  int NOT NULL DEFAULT 0,
  is_hidden     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id    ON inbox_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON inbox_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id    ON inbox_messages(sender_id);

-- RLS
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can read own messages"
  ON inbox_messages FOR SELECT
  USING (auth.uid() = recipient_id AND is_hidden = false);

CREATE POLICY "Senders can read sent messages"
  ON inbox_messages FOR SELECT
  USING (auth.uid() = sender_id AND is_hidden = false);
```

---

## Migration 007 — subscriptions

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider                 text NOT NULL DEFAULT 'manual'
                           CHECK (provider IN ('stripe','payme','fps_manual','manual')),
  provider_customer_id     text,
  provider_subscription_id text,
  status                   text NOT NULL DEFAULT 'free'
                           CHECK (status IN ('free','active','past_due','cancelled','manual')),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Migration 008 — usage_quotas

```sql
CREATE TABLE IF NOT EXISTS usage_quotas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quota_type   text NOT NULL
               CHECK (quota_type IN ('forum_post_daily','active_letter_monthly','match_monthly')),
  used_count   int NOT NULL DEFAULT 0,
  limit_count  int NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quota_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_quotas_user_id_type ON usage_quotas(user_id, quota_type);

-- RLS
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own quotas"
  ON usage_quotas FOR SELECT
  USING (auth.uid() = user_id);
```

**配額上限（程式 `src/lib/permissions.js`，非 DB 約束）：**

| `quota_type` | Free | Premium |
|---|---|---|
| `forum_post_daily` | 3／日 | 不限 |
| `active_letter_monthly` | 0 | 3／月 |
| `match_monthly` | 3／月 | 999 |
| `photo_exchange_monthly` | 0 | 3／月 |

---

## Migration 009 — user_blocks

```sql
CREATE TABLE IF NOT EXISTS user_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON user_blocks(blocked_id);

-- RLS
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blocker can read own blocks"
  ON user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);
```

---

## Migration 010 — forum_posts

```sql
CREATE TABLE IF NOT EXISTS forum_posts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id                uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                    text,
  content                  text NOT NULL,
  topic                    text NOT NULL DEFAULT '圈內日常',
  mood_tag                 text,
  anonymous_name_snapshot  text NOT NULL DEFAULT '',
  like_count               int NOT NULL DEFAULT 0,
  comment_count            int NOT NULL DEFAULT 0,
  report_count             int NOT NULL DEFAULT 0,
  visibility               text NOT NULL DEFAULT 'public'
                           CHECK (visibility IN ('public','members_only','hidden')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_forum_posts_updated_at
  BEFORE UPDATE ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id  ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic       ON forum_posts(topic);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at DESC);

-- RLS
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public posts visible to all"
  ON forum_posts FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Members-only posts visible to authed users"
  ON forum_posts FOR SELECT
  USING (visibility = 'members_only' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authors can update own posts"
  ON forum_posts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authenticated users can insert posts"
  ON forum_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id AND auth.uid() IS NOT NULL);
```

---

## Migration 011 — forum_comments

```sql
CREATE TABLE IF NOT EXISTS forum_comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES forum_comments(id) ON DELETE CASCADE,
  content           text NOT NULL,
  report_count      int NOT NULL DEFAULT 0,
  is_hidden         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id   ON forum_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_author_id ON forum_comments(author_id);

-- RLS
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments visible to all (non-hidden)"
  ON forum_comments FOR SELECT
  USING (is_hidden = false);

CREATE POLICY "Authenticated users can insert comments"
  ON forum_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id AND auth.uid() IS NOT NULL);
```

---

## Required Environment Variables

These must be set in Vercel (and `.env.local` for local dev):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose to client) |

The service role key is required for admin operations (legacy claim resolution, manual Premium activation).

---

## Notes

- Run migrations in order 001 → 011.
- Migrations 003 is safe to run on existing `responses` table — only adds nullable columns.
- The `update_updated_at_column()` function is created once in 001 and reused.
- RLS policies above are a starting point. Review and tighten before production.
- All API routes use the service role key server-side. Never pass it to the frontend.
