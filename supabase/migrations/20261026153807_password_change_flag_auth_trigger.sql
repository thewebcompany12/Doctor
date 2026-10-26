create or replace function private.clear_password_change_flag_on_auth_password_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password and new.encrypted_password is not null then
    update public.profiles set must_change_password=false,updated_at=now()
    where id=new.id and must_change_password=true;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_password_change_flag_on_auth_password_change() from public,anon,authenticated;
drop trigger if exists doctor_queue_password_change_flag on auth.users;
create trigger doctor_queue_password_change_flag after update of encrypted_password on auth.users
for each row execute function private.clear_password_change_flag_on_auth_password_change();
drop function if exists public.clear_password_change_flag();
drop function if exists private.clear_password_change_flag();
