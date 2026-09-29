-- =============================================================================
-- 0002 — Topic-level analytics + "re-test weak concepts"
-- Backward compatible: adds a view, and an optional p_topic_ids argument to
-- start_session (existing callers keep working).
-- =============================================================================

-- My accuracy per topic (chapter). security_invoker → RLS limits it to my rows.
create or replace view public.v_my_topic_performance
with (security_invoker = true) as
select
  t.id                                                     as topic_id,
  t.title                                                  as topic_title,
  s.slug                                                   as subject_category,
  s.name                                                   as subject_name,
  count(r.id)                                              as answered,
  count(r.id) filter (where r.is_correct)                  as correct,
  round(100.0 * count(r.id) filter (where r.is_correct) / nullif(count(r.id), 0), 1) as accuracy_pct
from public.user_responses r
join public.questions q on q.id = r.question_id
join public.topics t    on t.id = q.topic_id
join public.subjects s  on s.id = t.subject_id
where r.user_id = (select auth.uid())
  and r.is_correct is not null
group by t.id, t.title, s.slug, s.name, s.sort_order;

grant select on public.v_my_topic_performance to authenticated;

-- start_session gains p_topic_ids (tutor mode filter).
drop function if exists public.start_session(public.study_mode, text, text[], int, public.exam_target, boolean);

create or replace function public.start_session(
  p_mode         public.study_mode,
  p_mock_format  text                default null,
  p_subjects     text[]              default null,
  p_count        int                 default 20,
  p_exam         public.exam_target  default null,
  p_unseen_only  boolean             default false,
  p_topic_ids    uuid[]              default null    -- NEW: restrict tutor sets to these topics
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
        and (p_topic_ids is null or q.topic_id = any (p_topic_ids))
      order by s.srs_box, s.due_at nulls last
      limit v_limit
    ) pick;

  else  -- tutor
    select array_agg(id) into v_ids from (
      select q.id from public.questions q
      where q.is_published
        and (p_subjects is null or q.subject_category = any (p_subjects))
        and (p_topic_ids is null or q.topic_id = any (p_topic_ids))
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

revoke all on function public.start_session(public.study_mode, text, text[], int, public.exam_target, boolean, uuid[]) from public, anon;
grant execute on function public.start_session(public.study_mode, text, text[], int, public.exam_target, boolean, uuid[]) to authenticated;
