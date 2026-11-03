-- Diagnostic des paiements Ecomfy Pay en PENDING (lecture seule). Éditeur SQL de la PRODUCTION.
-- Hypothèses testées : (A) clés GeniusPay absentes -> paiement créé sans provider_reference, sans lien de paiement ;
-- (B) lien créé mais webhook jamais arrivé ; (C) abandon du client ; (D) webhook reçu mais rejeté (payment_events).
select p.internal_reference,
       to_char(p.created_at, 'DD/MM HH24:MI') as cree,
       p.amount,
       p.payment_method,
       p.provider,
       (p.provider_reference is not null) as a_ref_operateur,
       p.order_id is not null as a_commande,
       o.order_status,
       o.payment_status as paiement_commande,
       (select count(*) from public.payment_events e
         where e.provider = p.provider
           and (e.payload::text like '%' || p.internal_reference || '%'
                or (p.provider_reference is not null and e.payload::text like '%' || p.provider_reference || '%'))) as evenements_webhook,
       (select count(*) from public.wallet_ledger l where l.payment_id = p.id) as ecritures_ledger
from public.ecomfy_payments p
left join public.orders o on o.id = p.order_id
where p.status = 'PENDING'
order by p.created_at desc;

-- Synthèse globale : tous statuts, depuis le début
select status, count(*) as nb, count(provider_reference) as avec_ref_operateur,
       to_char(min(created_at), 'DD/MM') as premier, to_char(max(created_at), 'DD/MM') as dernier
from public.ecomfy_payments group by status order by 2 desc;
