-- Adds the missing UPDATE RLS policy for meetings.
-- Without this, web-side meeting edits (notesMarkdown, myNotesMarkdown, title, etc.)
-- are silently denied by RLS even though the row belongs to the requesting user.

create policy "owner_update" on public.meetings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
