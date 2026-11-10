begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sora-avatars', 'sora-avatars', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
do $$
begin
  if exists (select 1 from storage.buckets where id = 'sora-avatars' and public) then
    raise exception 'sora-avatars must be private; review the existing bucket before continuing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sora_avatar_read_own') then
    create policy sora_avatar_read_own on storage.objects for select to authenticated
      using (bucket_id='sora-avatars' and name=(select auth.uid())::text || '/avatar.jpg');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sora_avatar_insert_own') then
    create policy sora_avatar_insert_own on storage.objects for insert to authenticated
      with check (bucket_id='sora-avatars' and name=(select auth.uid())::text || '/avatar.jpg');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sora_avatar_update_own') then
    create policy sora_avatar_update_own on storage.objects for update to authenticated
      using (bucket_id='sora-avatars' and name=(select auth.uid())::text || '/avatar.jpg')
      with check (bucket_id='sora-avatars' and name=(select auth.uid())::text || '/avatar.jpg');
  end if;
end $$;
commit;
