create or replace function private.has_clinic_role(target_clinic uuid, allowed_roles text[] default null)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private
as $$
  select auth.uid() is not null and exists (
    select 1 from public.clinic_memberships m where m.clinic_id=target_clinic and m.user_id=auth.uid() and m.is_active
      and (allowed_roles is null or m.role=any(allowed_roles))
  );
$$;
create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path=pg_catalog,public,private
as $$ select auth.uid() is not null and exists (select 1 from public.platform_roles r where r.user_id=auth.uid() and r.role='super_admin'); $$;
create or replace function private.clear_password_change_flag()
returns void language plpgsql security definer set search_path=pg_catalog,public,private
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 update public.profiles set must_change_password=false,updated_at=now() where id=auth.uid();
end;
$$;
grant usage on schema private to authenticated;
revoke all on function private.has_clinic_role(uuid,text[]) from public,anon;
revoke all on function private.is_platform_admin() from public,anon;
revoke all on function private.clear_password_change_flag() from public,anon;
grant execute on function private.has_clinic_role(uuid,text[]) to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.clear_password_change_flag() to authenticated;
do $$
declare r record; definition text;
begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prokind='f'
    and p.proname not in ('has_clinic_role','is_platform_admin','clear_password_change_flag')
    and (pg_get_functiondef(p.oid) like '%public.has_clinic_role%' or pg_get_functiondef(p.oid) like '%public.is_platform_admin%')
 loop
  definition := pg_get_functiondef(r.oid);
  definition := replace(definition,'public.has_clinic_role','private.has_clinic_role');
  definition := replace(definition,'public.is_platform_admin','private.is_platform_admin');
  execute definition;
 end loop;
end;
$$;
do $$
declare p record; new_using text; new_check text; statement text;
begin
 for p in select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public'
 loop
  new_using := replace(replace(p.qual,'has_clinic_role(','private.has_clinic_role('),'is_platform_admin()','private.is_platform_admin()');
  new_check := replace(replace(p.with_check,'has_clinic_role(','private.has_clinic_role('),'is_platform_admin()','private.is_platform_admin()');
  execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  statement := format('create policy %I on %I.%I as %s for %s to %s',p.policyname,p.schemaname,p.tablename,lower(p.permissive),p.cmd,array_to_string(p.roles,', '));
  if p.qual is not null then statement := statement || format(' using (%s)',new_using); end if;
  if p.with_check is not null then statement := statement || format(' with check (%s)',new_check); end if;
  execute statement;
 end loop;
end;
$$;
drop function public.has_clinic_role(uuid,text[]);
create or replace function public.is_platform_admin()
returns boolean language sql stable security invoker set search_path=pg_catalog,public,private as $$ select private.is_platform_admin(); $$;
revoke all on function public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;
create or replace function public.clear_password_change_flag()
returns void language sql security invoker set search_path=pg_catalog,public,private as $$ select private.clear_password_change_flag(); $$;
revoke all on function public.clear_password_change_flag() from public,anon;
grant execute on function public.clear_password_change_flag() to authenticated;
