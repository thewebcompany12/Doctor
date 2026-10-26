alter function public.issue_staff_token(uuid,text,text) set search_path = pg_catalog,public,private;
alter function public.transition_queue_token(uuid,text,text,text) set search_path = pg_catalog,public,private;
alter function public.advance_queue(uuid,text) set search_path = pg_catalog,public,private;
alter function public.create_clinic_queue(uuid,text,text,text,integer,boolean,boolean) set search_path = pg_catalog,public,private;
alter function public.set_queue_status(uuid,text) set search_path = pg_catalog,public,private;
