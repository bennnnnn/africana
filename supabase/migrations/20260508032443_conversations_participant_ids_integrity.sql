-- Enforce 2-party conversation integrity and uniqueness.
--
-- Prevent:
--  - participant_ids with 1 or 3+ entries
--  - duplicate ids (self-chat / [a,a])
--  - multiple conversations for the same unordered pair

alter table public.conversations
  alter column participant_ids set not null;

alter table public.conversations
  drop constraint if exists conversations_participant_ids_two_distinct;

alter table public.conversations
  add constraint conversations_participant_ids_two_distinct
  check (
    cardinality(participant_ids) = 2
    and participant_ids[1] is not null
    and participant_ids[2] is not null
    and participant_ids[1] <> participant_ids[2]
  );

-- Unique unordered pair: (least(a,b), greatest(a,b)).
create unique index if not exists conversations_participants_pair_unique_idx
  on public.conversations (
    least(participant_ids[1], participant_ids[2]),
    greatest(participant_ids[1], participant_ids[2])
  );

