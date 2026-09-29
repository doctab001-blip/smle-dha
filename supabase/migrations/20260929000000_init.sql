-- =============================================================================
-- SCFHS / DHA Prep Platform — initial schema
-- Target: Supabase (PostgreSQL 15+). Run with `supabase db push` or paste into
-- the SQL editor in one go.
--
-- Design principles
--   1. CONTENT IS NEVER LOCKED. Subjects, topics, high-yield notes and questions
--      carry no lock/prerequisite/unlock columns. `is_published` exists only so
--      editors can keep drafts hidden — it is not a progression gate.
--   2. ANSWERS NEVER REACH THE BROWSER UNTIL EARNED. `questions.correct_answer`,
--      `explanation` and `option_explanations` are column-revoked from the
--      `authenticated` role. They are returned only by SECURITY DEFINER RPCs:
--        tutor/revision -> answer_question() returns them immediately
--        mock           -> only after submit_session(), via get_session_review()
--   3. GRADING IS SERVER-SIDE. Users cannot insert into user_responses directly,
--      so `is_correct` (and therefore accuracy/percentile) can't be forged.
--   4. Users can read ONLY their own responses, sessions, flags and notes (RLS).
--   5. Content writes (questions, notes) go through the service_role key from
--      the Next.js admin area after a server-side role check.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Types & helpers
-- -----------------------------------------------------------------------------
create type public.user_role        as enum ('student', 'editor', 'admin');
create type public.exam_target      as enum ('smle', 'dha', 'doh', 'mohap');   -- SA: SMLE (SCFHS) | UAE: DHA, DOH (Abu Dhabi), MOHAP
create type public.study_mode       as enum ('tutor', 'mock', 'revision');
create type public.session_status   as enum ('in_progress', 'submitted', 'abandoned');
create type public.difficulty_level as enum ('easy', 'medium', 'hard');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- -----------------------------------------------------------------------------
-- 1. users  (profile row per auth.users row, created by trigger on signup)
-- -----------------------------------------------------------------------------
create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  target_exam        public.exam_target not null default 'smle',
  country            text check (country in ('SA', 'AE')),
  planned_exam_date  date,
  role               public.user_role not null default 'student',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by admin-area server code and any staff-only policies.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('editor', 'admin')
  );
$$;


-- -----------------------------------------------------------------------------
-- 2. Curriculum: subjects -> topics (chapters) -> high_yield_notes
--    NO locking columns anywhere, by design.
-- -----------------------------------------------------------------------------
create table public.subjects (
  id          smallint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  sort_order  smallint not null default 0
);

insert into public.subjects (slug, name, sort_order) values
  ('internal-medicine',  'Internal Medicine',             1),
  ('general-surgery',    'General Surgery',               2),
  ('pediatrics',         'Pediatrics',                    3),
  ('obgyn',              'Obstetrics & Gynecology',       4),
  ('preventive-ethics',  'Preventive Medicine & Ethics',  5),
  ('psychiatry',         'Psychiatry',                    6);

create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  subject_id  smallint not null references public.subjects (id) on delete restrict,
  slug        text not null,
  title       text not null,
  sort_order  int not null default 0,
  unique (subject_id, slug)
);

create table public.high_yield_notes (
  id             uuid primary key default gen_random_uuid(),
  topic_id       uuid not null references public.topics (id) on delete cascade,
  slug           text not null unique,
  title          text not null,
  body_md        text not null,                         -- Markdown (tables, lists, callouts)
  source_refs    text[] not null default '{}',          -- guideline citations
  is_published   boolean not null default true,         -- draft flag only, NOT a lock
  search         tsvector generated always as (
                   to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_md, ''))
                 ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger high_yield_notes_updated_at before update on public.high_yield_notes
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. Tags — regional clinical nuances (and room for systems/skills later)
-- -----------------------------------------------------------------------------
create table public.tags (
  id     smallint generated always as identity primary key,
  slug   text not null unique,
  label  text not null,
  kind   text not null default 'regional' check (kind in ('regional', 'system', 'skill'))
);

insert into public.tags (slug, label) values
  ('consanguinity',          'Consanguinity & AR genetic disease'),
  ('sickle-cell-disease',    'Sickle cell disease'),
  ('thalassaemia',           'Thalassaemia'),
  ('g6pd-deficiency',        'G6PD deficiency'),
  ('mers-cov',               'MERS-CoV'),
  ('ramadan-fasting',        'Ramadan fasting & medication adjustment'),
  ('hajj-umrah',             'Hajj / Umrah (mass-gathering medicine)'),
  ('brucellosis',            'Brucellosis'),
  ('islamic-medical-ethics', 'Islamic medical ethics & Saudi/UAE law');


-- -----------------------------------------------------------------------------
-- 4. questions
-- -----------------------------------------------------------------------------
create table public.questions (
  id                   uuid primary key default gen_random_uuid(),
  subject_category     text not null references public.subjects (slug) on update cascade,
  topic_id             uuid references public.topics (id) on delete set null,
  note_id              uuid references public.high_yield_notes (id) on delete set null,  -- note shown under the question

  text                 text not null,         -- clinical vignette
  lead_in              text,                  -- e.g. "What is the most appropriate next step?"
  lab_values           jsonb,                 -- [{"test":"Hb","value":"7.2","unit":"g/dL","ref":"12-16"}]
  media                jsonb not null default '[]'::jsonb,   -- [{"type":"image","url":"...","caption":"ECG"}]
  options              jsonb not null,        -- [{"key":"A","text":"..."}, ...]
  correct_answer       char(1) not null check (correct_answer ~ '^[A-F]$'),
  explanation          text not null,         -- Markdown
  option_explanations  jsonb,                 -- {"A":"why wrong...", "B":"..."}

  exam_targets         public.exam_target[] not null default '{smle,dha}',
  difficulty           public.difficulty_level not null default 'medium',
  source_refs          text[] not null default '{}',
  is_published         boolean not null default false,
  created_by           uuid references public.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint options_shape check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
  ),
  constraint correct_answer_is_an_option check (
    options @> jsonb_build_array(jsonb_build_object('key', correct_answer))
  )
);
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_tags (
  question_id  uuid not null references public.questions (id) on delete cascade,
  tag_id       smallint not null references public.tags (id) on delete cascade,
  primary key (question_id, tag_id)
);


-- -----------------------------------------------------------------------------
-- 5. Study sessions (tutor / revision / timed mock)
--    Mock durations live in data, not code — confirm against the current
--    SCFHS and DHA candidate handbooks and update rows as formats change.
-- -----------------------------------------------------------------------------
create table public.mock_formats (
  code              text primary key,
  label             text not null,
  exam              public.exam_target not null,
  question_count    int not null check (question_count > 0),
  duration_minutes  int not null check (duration_minutes > 0),
  is_active         boolean not null default true
);

insert into public.mock_formats (code, label, exam, question_count, duration_minutes) values
  ('smle_200', 'SMLE mock — 200 questions', 'smle', 200, 240),  -- duration: PLACEHOLDER, verify
  ('dha_150',  'DHA mock — 150 questions',  'dha',  150, 165);  -- duration: PLACEHOLDER, verify

create table public.study_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  mode                public.study_mode not null,
  mock_format         text references public.mock_formats (code),
  question_ids        uuid[] not null,          -- fixed order for the block
  subject_filter      text[],
  time_limit_seconds  int,
  started_at          timestamptz not null default now(),
  expires_at          timestamptz,
  submitted_at        timestamptz,
  status              public.session_status not null default 'in_progress',
  score_correct       int,
  score_total         int,
  constraint mock_needs_format check ((mode = 'mock') = (mock_format is not null))
);


-- -----------------------------------------------------------------------------
-- 6. user_responses — one row per question per session
--    is_correct is NULL for mock answers until the block is submitted, so the
--    user can't learn right/wrong mid-exam by reading their own rows.
-- -----------------------------------------------------------------------------
create table public.user_responses (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references public.users (id) on delete cascade,
  question_id         uuid not null references public.questions (id) on delete cascade,
  session_id          uuid not null references public.study_sessions (id) on delete cascade,
  subject_category    text not null,           -- denormalised for cheap analytics
  selected_answer     char(1) check (selected_answer ~ '^[A-F]$'),   -- NULL = left blank
  is_correct          boolean,
  time_taken_seconds  int check (time_taken_seconds >= 0),
  mode                public.study_mode not null,
  answered_at         timestamptz not null default now(),
  unique (session_id, question_id)
);


-- -----------------------------------------------------------------------------
-- 7. user_question_state — flags, personal notes, spaced repetition
--
--    Spaced repetition (Leitner boxes). A question enters the revision pool
--    only once it has been answered wrongly (or is flagged):
--      wrong answer           -> box 1, due now      (comes back soonest)
--      right, box 1 -> 2      -> due in 3 days
--      right, box 2 -> 3      -> due in 7 days
--      right, box 3 -> 4      -> due in 14 days
--      right, box 4/5 -> 5    -> due in 30 days
--      right first time       -> box 0, never scheduled
--    Revision sets pull due items ordered by box (lowest first), so recently
--    missed questions reappear most often.
-- -----------------------------------------------------------------------------
create table public.user_question_state (
  user_id           uuid not null references public.users (id) on delete cascade,
  question_id       uuid not null references public.questions (id) on delete cascade,
  is_flagged        boolean not null default false,
  note              text check (char_length(note) <= 5000),
  srs_box           smallint not null default 0 check (srs_box between 0 and 5),
  due_at            timestamptz,
  times_seen        int not null default 0,
  times_correct     int not null default 0,
  times_incorrect   int not null default 0,
  last_correct      boolean,
  last_answered_at  timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (user_id, question_id)
);


-- -----------------------------------------------------------------------------
-- 8. Indexes
-- -----------------------------------------------------------------------------
create index questions_subject_idx      on public.questions (subject_category) where is_published;
create index questions_topic_idx        on public.questions (topic_id);
create index questions_exam_targets_idx on public.questions using gin (exam_targets);
create index question_tags_tag_idx      on public.question_tags (tag_id);
create index notes_topic_idx            on public.high_yield_notes (topic_id);
create index notes_search_idx           on public.high_yield_notes using gin (search);
create index topics_subject_idx         on public.topics (subject_id);
create index sessions_user_idx          on public.study_sessions (user_id, started_at desc);
create index responses_user_idx         on public.user_responses (user_id, answered_at desc);
create index responses_user_subject_idx on public.user_responses (user_id, subject_category) include (is_correct);
create index responses_question_idx     on public.user_responses (question_id) include (is_correct, selected_answer);
create index uqs_due_idx                on public.user_question_state (user_id, srs_box, due_at) where srs_box > 0;
create index uqs_flagged_idx            on public.user_question_state (user_id) where is_flagged;


-- -----------------------------------------------------------------------------
-- 9. Privileges
--    Supabase grants ALL on new public tables to anon/authenticated by default,
--    so we revoke and re-grant exactly what the browser needs.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Open curriculum (readable even when logged out — good for SEO on notes)
grant select on public.subjects, public.topics, public.tags,
                public.high_yield_notes, public.mock_formats
  to anon, authenticated;

-- Questions: stem + options only. NO correct_answer / explanation / option_explanations.
-- Note for the frontend: `select('*')` will fail — always list columns.
grant select (id, subject_category, topic_id, note_id, text, lead_in, lab_values, media,
              options, exam_targets, difficulty, is_published, created_at, updated_at)
  on public.questions to authenticated;
grant select on public.question_tags to authenticated;

-- Own data (row-limited by RLS below). Writes happen via RPCs only.
grant select on public.users, public.study_sessions,
                public.user_responses, public.user_question_state
  to authenticated;
grant update (full_name, target_exam, country, planned_exam_date)
  on public.users to authenticated;                -- `role` is deliberately not updatable


-- -----------------------------------------------------------------------------
-- 10. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.subjects            enable row level security;
alter table public.topics              enable row level security;
alter table public.high_yield_notes    enable row level security;
alter table public.tags                enable row level security;
alter table public.questions           enable row level security;
alter table public.question_tags       enable row level security;
alter table public.mock_formats        enable row level security;
alter table public.study_sessions      enable row level security;
alter table public.user_responses      enable row level security;
alter table public.user_question_state enable row level security;

-- users: see and edit only yourself
create policy "users: read own"   on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy "users: update own" on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- curriculum: everything open, no gating
create policy "subjects: open"     on public.subjects     for select to anon, authenticated using (true);
create policy "topics: open"       on public.topics       for select to anon, authenticated using (true);
create policy "tags: open"         on public.tags         for select to anon, authenticated using (true);
create policy "mock formats: open" on public.mock_formats for select to anon, authenticated using (is_active);
create policy "notes: all published notes open" on public.high_yield_notes
  for select to anon, authenticated using (is_published);

-- questions: every published question available to every signed-in user
create policy "questions: all published open" on public.questions
  for select to authenticated using (is_published);
create policy "question tags: open" on public.question_tags
  for select to authenticated using (true);

-- personal data: own rows only
create policy "sessions: read own" on public.study_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "responses: read own" on public.user_responses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "question state: read own" on public.user_question_state
  for select to authenticated using (user_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 11. Internal helpers (not callable from the browser)
-- -----------------------------------------------------------------------------
create or replace function public._srs_interval(p_box smallint)
returns interval language sql immutable as $$
  select case p_box
    when 2 then interval '3 days'
    when 3 then interval '7 days'
    when 4 then interval '14 days'
    when 5 then interval '30 days'
    else interval '0'
  end;
$$;

create or replace function public._srs_apply(p_uid uuid, p_qid uuid, p_correct boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_question_state as s
    (user_id, question_id, srs_box, due_at, times_seen, times_correct, times_incorrect,
     last_correct, last_answered_at)
  values
    (p_uid, p_qid,
     case when p_correct then 0 else 1 end,
     case when p_correct then null else now() end,
     1, p_correct::int, (not p_correct)::int, p_correct, now())
  on conflict (user_id, question_id) do update set
    srs_box = case
                when not p_correct  then 1
                when s.srs_box = 0  then 0
                else least(s.srs_box + 1, 5)
              end,
    due_at  = case
                when not p_correct  then now()
                when s.srs_box = 0  then null
                else now() + public._srs_interval(least(s.srs_box + 1, 5)::smallint)
              end,
    times_seen       = s.times_seen + 1,
    times_correct    = s.times_correct + p_correct::int,
    times_incorrect  = s.times_incorrect + (not p_correct)::int,
    last_correct     = p_correct,
    last_answered_at = now(),
    updated_at       = now();
end $$;

-- "% of users who answered correctly" + distribution per option (Passmedicine-style)
create or replace function public._question_peer_stats(p_qid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'attempts',    count(*),
    'pct_correct', round(100.0 * avg(is_correct::int), 1),
    'by_option',   coalesce((
        select jsonb_object_agg(selected_answer, n)
        from (select selected_answer, count(*) as n
              from public.user_responses
              where question_id = p_qid and is_correct is not null and selected_answer is not null
              group by selected_answer) t
      ), '{}'::jsonb)
  )
  from public.user_responses
  where question_id = p_qid and is_correct is not null;
$$;


-- -----------------------------------------------------------------------------
-- 12. Public RPCs (call with supabase.rpc(...))
-- -----------------------------------------------------------------------------

-- Start a session. Returns the session id; the client then fetches the question
-- stems for study_sessions.question_ids (in that order).
create or replace function public.start_session(
  p_mode         public.study_mode,
  p_mock_format  text                default null,   -- required for 'mock'
  p_subjects     text[]              default null,   -- null = all subjects
  p_count        int                 default 20,     -- tutor/revision (max 100)
  p_exam         public.exam_target  default null,   -- tutor filter
  p_unseen_only  boolean             default false   -- tutor filter
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_fmt     public.mock_formats;
  v_ids     uuid[];
  v_limit   int := least(greatest(coalesce(p_count, 20), 1), 100);
  v_session uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_mode = 'mock' then
    select * into v_fmt from public.mock_formats where code = p_mock_format and is_active;
    if not found then
      raise exception 'Unknown mock format: %', p_mock_format;
    end if;
    select array_agg(id) into v_ids from (
      select q.id from public.questions q
      where q.is_published and v_fmt.exam = any (q.exam_targets)
      order by random()
      limit v_fmt.question_count
    ) pick;

  elsif p_mode = 'revision' then
    select array_agg(question_id order by srs_box, due_at nulls last) into v_ids from (
      select s.question_id, s.srs_box, s.due_at
      from public.user_question_state s
      join public.questions q on q.id = s.question_id and q.is_published
      where s.user_id = v_uid
        and ((s.srs_box > 0 and s.due_at <= now()) or s.is_flagged)
        and (p_subjects is null or q.subject_category = any (p_subjects))
      order by s.srs_box, s.due_at nulls last
      limit v_limit
    ) pick;

  else  -- tutor
    select array_agg(id) into v_ids from (
      select q.id from public.questions q
      where q.is_published
        and (p_subjects is null or q.subject_category = any (p_subjects))
        and (p_exam is null or p_exam = any (q.exam_targets))
        and (not p_unseen_only or not exists (
              select 1 from public.user_responses r
              where r.user_id = v_uid and r.question_id = q.id))
      order by random()
      limit v_limit
    ) pick;
  end if;

  if v_ids is null then
    raise exception 'No questions match these filters';
  end if;

  insert into public.study_sessions
    (user_id, mode, mock_format, question_ids, subject_filter, time_limit_seconds, expires_at)
  values
    (v_uid, p_mode,
     case when p_mode = 'mock' then v_fmt.code end,
     v_ids, p_subjects,
     case when p_mode = 'mock' then v_fmt.duration_minutes * 60 end,
     case when p_mode = 'mock' then now() + make_interval(mins => v_fmt.duration_minutes) end)
  returning id into v_session;

  return v_session;
end $$;


-- Answer a question.
--   tutor/revision -> graded immediately; returns correct answer, explanation,
--                     linked note id and peer stats. One attempt per question.
--   mock           -> saved ungraded (answer can be changed until submit or
--                     time-out); returns only {"saved": true}.
create or replace function public.answer_question(
  p_session_id    uuid,
  p_question_id   uuid,
  p_selected      char(1),
  p_time_seconds  int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_s         public.study_sessions;
  v_q         record;
  v_existing  public.user_responses;
  v_correct   boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_s from public.study_sessions
  where id = p_session_id and user_id = v_uid
  for update;
  if not found then raise exception 'Session not found'; end if;
  if v_s.status <> 'in_progress' then raise exception 'Session is closed'; end if;
  if not (p_question_id = any (v_s.question_ids)) then
    raise exception 'Question is not part of this session';
  end if;
  if p_selected is not null and p_selected !~ '^[A-F]$' then
    raise exception 'Invalid option';
  end if;

  select q.correct_answer, q.explanation, q.option_explanations, q.note_id, q.subject_category
  into v_q
  from public.questions q where q.id = p_question_id;

  -- ---- Mock: store, don't reveal ----
  if v_s.mode = 'mock' then
    if now() > v_s.expires_at + interval '30 seconds' then
      raise exception 'Time is up for this block';
    end if;
    insert into public.user_responses as r
      (user_id, question_id, session_id, subject_category, selected_answer, is_correct,
       time_taken_seconds, mode)
    values
      (v_uid, p_question_id, p_session_id, v_q.subject_category, p_selected, null,
       p_time_seconds, 'mock')
    on conflict (session_id, question_id) do update set
      selected_answer    = excluded.selected_answer,
      time_taken_seconds = coalesce(r.time_taken_seconds, 0) + coalesce(excluded.time_taken_seconds, 0),
      answered_at        = now();
    return jsonb_build_object('saved', true);
  end if;

  -- ---- Tutor / revision: grade now ----
  select * into v_existing from public.user_responses
  where session_id = p_session_id and question_id = p_question_id;

  if found then
    v_correct  := v_existing.is_correct;       -- already answered: replay the result
    p_selected := v_existing.selected_answer;
  else
    if p_selected is null then raise exception 'Select an option first'; end if;
    v_correct := (p_selected = v_q.correct_answer);
    insert into public.user_responses
      (user_id, question_id, session_id, subject_category, selected_answer, is_correct,
       time_taken_seconds, mode)
    values
      (v_uid, p_question_id, p_session_id, v_q.subject_category, p_selected, v_correct,
       p_time_seconds, v_s.mode);
    perform public._srs_apply(v_uid, p_question_id, v_correct);
  end if;

  return jsonb_build_object(
    'is_correct',          v_correct,
    'selected_answer',     p_selected,
    'correct_answer',      v_q.correct_answer,
    'explanation',         v_q.explanation,
    'option_explanations', v_q.option_explanations,
    'note_id',             v_q.note_id,
    'peer_stats',          public._question_peer_stats(p_question_id)
  );
end $$;


-- Submit (or auto-submit on time-out) a session. For mocks this grades every
-- answer, records blanks as incorrect, and feeds everything into spaced
-- repetition. Idempotent: re-submitting returns the stored score.
create or replace function public.submit_session(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_s        public.study_sessions;
  v_row      record;
  v_correct  int;
  v_total    int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_s from public.study_sessions
  where id = p_session_id and user_id = v_uid
  for update;
  if not found then raise exception 'Session not found'; end if;

  if v_s.status = 'in_progress' then
    if v_s.mode = 'mock' then
      -- blanks
      insert into public.user_responses
        (user_id, question_id, session_id, subject_category, selected_answer, is_correct, mode)
      select v_uid, q.id, p_session_id, q.subject_category, null, null, 'mock'
      from public.questions q
      where q.id = any (v_s.question_ids)
      on conflict (session_id, question_id) do nothing;

      -- grade
      update public.user_responses ur
      set is_correct = coalesce(ur.selected_answer = q.correct_answer, false)
      from public.questions q
      where ur.session_id = p_session_id and q.id = ur.question_id;

      -- spaced repetition
      for v_row in
        select question_id, is_correct from public.user_responses where session_id = p_session_id
      loop
        perform public._srs_apply(v_uid, v_row.question_id, v_row.is_correct);
      end loop;
    end if;

    select count(*) filter (where is_correct), count(*)
    into v_correct, v_total
    from public.user_responses
    where session_id = p_session_id and is_correct is not null;

    update public.study_sessions
    set status = 'submitted', submitted_at = now(),
        score_correct = v_correct, score_total = v_total
    where id = p_session_id
    returning * into v_s;
  end if;

  return jsonb_build_object(
    'session_id', v_s.id,
    'correct',    v_s.score_correct,
    'total',      v_s.score_total,
    'pct',        round(100.0 * v_s.score_correct / nullif(v_s.score_total, 0), 1)
  );
end $$;


-- Answers + explanations for a session.
--   mock:          only after submission, all questions in block order
--   tutor/revision: only questions already answered (e.g. on page reload)
create or replace function public.get_session_review(p_session_id uuid)
returns table (
  question_id          uuid,
  sort_position        int,
  selected_answer      char(1),
  is_correct           boolean,
  correct_answer       char(1),
  explanation          text,
  option_explanations  jsonb,
  note_id              uuid,
  time_taken_seconds   int
)
language sql stable security definer set search_path = '' as $$
  select q.id, u.ord::int, r.selected_answer, r.is_correct, q.correct_answer,
         q.explanation, q.option_explanations, q.note_id, r.time_taken_seconds
  from public.study_sessions s
  cross join lateral unnest(s.question_ids) with ordinality as u(qid, ord)
  join public.questions q on q.id = u.qid
  left join public.user_responses r on r.session_id = s.id and r.question_id = q.id
  where s.id = p_session_id
    and s.user_id = auth.uid()
    and (   (s.mode = 'mock'  and s.status = 'submitted')
         or (s.mode <> 'mock' and r.is_correct is not null))
  order by u.ord;
$$;


-- Flag / unflag
create or replace function public.set_flag(p_question_id uuid, p_flagged boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  insert into public.user_question_state (user_id, question_id, is_flagged)
  values (auth.uid(), p_question_id, p_flagged)
  on conflict (user_id, question_id) do update
    set is_flagged = excluded.is_flagged, updated_at = now();
end $$;

-- Personal note on a question (empty string clears it)
create or replace function public.save_note(p_question_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  insert into public.user_question_state (user_id, question_id, note)
  values (auth.uid(), p_question_id, nullif(btrim(p_note), ''))
  on conflict (user_id, question_id) do update
    set note = excluded.note, updated_at = now();
end $$;


-- -----------------------------------------------------------------------------
-- 13. Analytics
-- -----------------------------------------------------------------------------

-- Radar chart data: my accuracy per subject (all six subjects always returned)
create view public.v_my_subject_performance
with (security_invoker = true) as
select
  s.slug                                                   as subject_category,
  s.name,
  s.sort_order,
  count(r.id)                                              as answered,
  count(r.id) filter (where r.is_correct)                  as correct,
  round(100.0 * count(r.id) filter (where r.is_correct)
        / nullif(count(r.id), 0), 1)                       as accuracy_pct,
  round(avg(r.time_taken_seconds))::int                    as avg_time_seconds
from public.subjects s
left join public.user_responses r
       on r.subject_category = s.slug
      and r.user_id = (select auth.uid())
      and r.is_correct is not null
group by s.id
order by s.sort_order;

grant select on public.v_my_subject_performance to authenticated;

-- Overall accuracy + percentile vs. all users with >= 50 graded answers.
-- percentile = % of that cohort you score higher than.
-- When the user base grows, back this with a materialized view refreshed by
-- pg_cron every ~15 min instead of computing live.
create or replace function public.get_my_percentile()
returns jsonb language sql stable security definer set search_path = '' as $$
  with per_user as (
    select user_id, count(*) as answered, avg(is_correct::int) as acc
    from public.user_responses
    where is_correct is not null
    group by user_id
  ),
  cohort as (
    select user_id, percent_rank() over (order by acc) as pr, count(*) over () as n
    from per_user
    where answered >= 50
  )
  select jsonb_build_object(
    'answered',       coalesce((select answered from per_user where user_id = auth.uid()), 0),
    'accuracy_pct',   (select round(100 * acc, 1) from per_user where user_id = auth.uid()),
    'percentile',     (select round(100 * pr)::int from cohort where user_id = auth.uid()),
    'cohort_size',    coalesce((select max(n) from cohort), 0),
    'min_for_rank',   50
  );
$$;

-- Cohort average per subject — second series on the radar ("you vs. average")
create or replace function public.get_cohort_subject_accuracy()
returns table (subject_category text, accuracy_pct numeric)
language sql stable security definer set search_path = '' as $$
  select r.subject_category, round(100.0 * avg(r.is_correct::int), 1)
  from public.user_responses r
  where r.is_correct is not null
  group by r.subject_category;
$$;


-- -----------------------------------------------------------------------------
-- 14. Function privileges
-- -----------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.start_session(public.study_mode, text, text[], int, public.exam_target, boolean),
  public.answer_question(uuid, uuid, char, int),
  public.submit_session(uuid),
  public.get_session_review(uuid),
  public.set_flag(uuid, boolean),
  public.save_note(uuid, text),
  public.get_my_percentile(),
  public.get_cohort_subject_accuracy(),
  public.is_staff()
to authenticated;

-- set_updated_at / handle_new_user run as triggers and need no grant.
-- _srs_apply, _srs_interval, _question_peer_stats stay internal.
