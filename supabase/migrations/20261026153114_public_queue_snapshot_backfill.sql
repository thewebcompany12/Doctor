do $$
declare rec record;
begin
  for rec in select id from public.queues loop
    perform private.refresh_public_queue_snapshot(rec.id);
  end loop;
end;
$$;
