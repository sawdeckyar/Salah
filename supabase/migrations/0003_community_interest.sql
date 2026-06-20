-- Salah backend — community interest (RSVP) + the "meetup" category.
-- Idempotent: safe whether or not 0002 was already applied. Run after 0002.

-- Interest counter on posts.
alter table public.community_post
  add column if not exists interested int not null default 0;

-- Allow the 'meetup' category.
alter table public.community_post
  drop constraint if exists community_post_category_check;
alter table public.community_post
  add constraint community_post_category_check
  check (category in ('fun','event','gathering','meetup'));

-- Atomic +/- on the interest counter (clamped at 0). Used for RSVP toggles.
create or replace function public.bump_interest(p_id uuid, p_delta int)
returns int language plpgsql security definer as $$
declare n int;
begin
  update public.community_post
  set interested = greatest(0, interested + p_delta)
  where id = p_id
  returning interested into n;
  return n;
end; $$;

grant execute on function public.bump_interest(uuid, int) to anon, authenticated;
