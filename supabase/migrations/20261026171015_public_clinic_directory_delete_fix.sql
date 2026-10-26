create or replace function private.refresh_public_clinic_directory_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if tg_table_name='clinics' then
  if tg_op='DELETE' then
   delete from public.public_clinic_directory where clinic_code=old.clinic_code;
   return old;
  end if;
  if tg_op='UPDATE' and old.clinic_code is distinct from new.clinic_code then
   delete from public.public_clinic_directory where clinic_code=old.clinic_code;
  end if;
  perform private.refresh_public_clinic_directory(new.id);
 elsif tg_table_name='doctors' then
  if tg_op<>'INSERT' then perform private.refresh_public_clinic_directory(old.clinic_id); end if;
  if tg_op<>'DELETE' and (tg_op<>'UPDATE' or old.clinic_id is distinct from new.clinic_id) then perform private.refresh_public_clinic_directory(new.clinic_id); end if;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.refresh_public_clinic_directory_trigger() from public,anon,authenticated,service_role;
