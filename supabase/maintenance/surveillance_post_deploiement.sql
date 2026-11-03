-- Surveillance post-déploiement (lecture seule). Éditeur SQL de la PRODUCTION (yfggrceynzcwklbxhgix).
-- Un seul résultat : section | détail. Aucune écriture.

select '01 tâches cron (24 h)' as section,
       j.jobname || ' : ' || count(*) || ' passages, ' ||
       count(*) filter (where d.status = 'succeeded') || ' ok, ' ||
       count(*) filter (where d.status <> 'succeeded') || ' en échec, dernier ' ||
       to_char(max(d.start_time), 'DD/MM HH24:MI') as detail
from cron.job j
left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '24 hours'
group by j.jobname

union all
select '02 cron : dernières erreurs',
       j.jobname || ' ' || to_char(d.start_time, 'DD/MM HH24:MI') || ' : ' || left(coalesce(d.return_message, ''), 160)
from cron.job_run_details d join cron.job j using (jobid)
where d.status <> 'succeeded' and d.start_time > now() - interval '48 hours'

union all
select '03 boutiques verrouillées / fermées',
       coalesce(to_jsonb(s)->>'name', s.id::text) || ' : ' || s.shop_payment_status ||
       ', suspendue=' || s.is_suspended || ', solde=' || coalesce(s.commission_balance_due, 0) ||
       ', locked_at=' || coalesce(to_char(s.locked_at, 'DD/MM HH24:MI'), '-')
from public.shops s
where s.shop_payment_status in ('locked', 'closed', 'payment_pending') or s.is_suspended

union all
select '04 événements de facturation (48 h)',
       e.event_type || ' : ' || count(*)
from public.shop_payment_events e
where e.created_at > now() - interval '48 hours'
group by e.event_type

union all
select '05 paiements Ecomfy Pay par statut (7 j)',
       status || ' : ' || count(*) || ', plus ancien ' || to_char(min(created_at), 'DD/MM HH24:MI')
from public.ecomfy_payments
where created_at > now() - interval '7 days'
group by status

union all
select '06 Ecomfy Pay PENDING depuis plus de 2 h',
       internal_reference || ' ' || to_char(created_at, 'DD/MM HH24:MI') || ' ' || amount
from public.ecomfy_payments
where status = 'PENDING' and created_at < now() - interval '2 hours'

union all
select '07 incidents ouverts',
       severity || ' / ' || category || ' : ' || title || ' (x' || occurrence_count || ', vu ' ||
       to_char(last_seen_at, 'DD/MM HH24:MI') || ')'
from public.app_incidents
where status = 'open'

union all
select '08 file e-mails (24 h)',
       status || ' : ' || count(*)
from public.email_send_log
where created_at > now() - interval '24 hours'
group by status

union all
select '09 pgmq : messages en attente',
       m.queue_name || ' : ' || m.queue_length || ' en file, plus ancien ' || coalesce(m.oldest_msg_age_sec::text, '-') || ' s'
from pgmq.metrics_all() m

union all
select '10 commandes (48 h)',
       order_status || ' : ' || count(*)
from public.orders
where created_at > now() - interval '48 hours'
group by order_status

order by 1, 2;
