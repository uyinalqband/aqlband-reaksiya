-- Match offer countdown starts when the target actually receives the offer.
-- Run once after 0033.

alter table public.checkers_match_offers
  add column if not exists delivered_at timestamptz;

-- 30 seconds is only a delivery grace period. The API changes expires_at to
-- delivered_at + 10 seconds on the first inbox delivery.
alter table public.checkers_match_offers
  alter column expires_at set default (now() + interval '30 seconds');

update public.checkers_match_offers
set expires_at = greatest(expires_at, created_at + interval '30 seconds')
where status = 'pending' and delivered_at is null;

create index if not exists idx_match_offers_pending_delivery
  on public.checkers_match_offers(target_user_id, created_at desc)
  where status = 'pending';

comment on column public.checkers_match_offers.delivered_at is
  'First time the target inbox returned this offer; the visible 10-second choice window starts here.';
