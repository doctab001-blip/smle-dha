-- =============================================================================
-- 0003 — Record the exam a new user chose on /smle or /dha.
-- users.target_exam already stores the active exam context; the signup form now
-- passes { exam: 'smle' | 'dha' } in auth metadata, and this trigger copies it
-- into the profile when the account is created (works with email confirmation).
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_exam text := lower(new.raw_user_meta_data ->> 'exam');
begin
  insert into public.users (id, full_name, target_exam, country)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case when v_exam in ('smle', 'dha', 'doh', 'mohap') then v_exam::public.exam_target else 'smle' end,
    case when v_exam = 'smle' then 'SA' when v_exam in ('dha', 'doh', 'mohap') then 'AE' end
  );
  return new;
end $$;
