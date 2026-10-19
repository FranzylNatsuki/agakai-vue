-- Short, human-readable explanation of what Agak remembers, shown above the notes.
alter table public."user"
  add column if not exists user_summary text not null default '';

-- The senior's own memory fields remain the only columns they may write.
grant update (user_notes, user_summary) on table public."user" to authenticated;
