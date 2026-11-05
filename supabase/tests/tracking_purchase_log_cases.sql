CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c,false), d) $$;
GRANT ALL ON _t TO PUBLIC; GRANT ALL ON SEQUENCE _t_n_seq TO PUBLIC;
DO $$
DECLARE u uuid := gen_random_uuid(); s uuid := gen_random_uuid(); o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); o3 uuid := gen_random_uuid();
  r jsonb; n int; l public.tracking_purchase_log;
BEGIN
  INSERT INTO shops VALUES (s, u, 'boutique');
  INSERT INTO orders(id,shop_id,order_number,payment_status) VALUES (o1,s,'CMD-1','paid'),(o2,s,'CMD-2','paid'),(o3,s,'CMD-3','pending');

  r := claim_purchase_send(s,o1,'ord_CMD-1','browser');
  PERFORM pg_temp.chk('1ere reservation acceptee', (r->>'claimed')::bool, r::text);
  r := claim_purchase_send(s,o1,'ord_CMD-1','server');
  PERFORM pg_temp.chk('2e appel simultane refuse (sending)', NOT (r->>'claimed')::bool AND r->>'status'='sending', r::text);
  PERFORM finish_purchase_send(s,o1,'sent',ARRAY['meta:12345','ga4']);
  r := claim_purchase_send(s,o1,'ord_CMD-1','server');
  PERFORM pg_temp.chk('rejeu apres envoi refuse (sent)', NOT (r->>'claimed')::bool AND r->>'status'='sent', r::text);
  SELECT * INTO l FROM tracking_purchase_log WHERE order_id=o1;
  PERFORM pg_temp.chk('sent : sent_at pose, destinations gardees', l.sent_at IS NOT NULL AND l.delivered @> ARRAY['meta:12345','ga4'], l::text);

  r := claim_purchase_send(s,o2,'ord_CMD-2','server');
  PERFORM finish_purchase_send(s,o2,'failed',ARRAY['meta:12345'],'non servi : ga4');
  r := claim_purchase_send(s,o2,'ord_CMD-2','server');
  PERFORM pg_temp.chk('reprise apres echec acceptee, destinations deja servies rendues', (r->>'claimed')::bool AND (r->'delivered') ? 'meta:12345' AND (r->>'attempts')::int=2, r::text);
  PERFORM finish_purchase_send(s,o2,'sent',ARRAY['ga4']);
  SELECT * INTO l FROM tracking_purchase_log WHERE order_id=o2;
  PERFORM pg_temp.chk('destinations cumulees sans doublon', l.status='sent' AND cardinality(l.delivered)=2, l::text);

  UPDATE tracking_purchase_log SET status='sending', claimed_at=now()-interval '3 minutes' WHERE order_id=o2;
  r := claim_purchase_send(s,o2,'ord_CMD-2','server');
  PERFORM pg_temp.chk('reservation perimee reprenable', (r->>'claimed')::bool, r::text);
  UPDATE tracking_purchase_log SET status='sent' WHERE order_id=o2;

  PERFORM finish_purchase_send(s,o1,'failed',ARRAY[]::text[],'x');
  SELECT * INTO l FROM tracking_purchase_log WHERE order_id=o1;
  PERFORM pg_temp.chk('finish ignore hors sending', l.status='sent', l.status);

  BEGIN
    PERFORM finish_purchase_send(s,o1,'bidon');
    PERFORM pg_temp.chk('statut invalide refuse', false);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.chk('statut invalide refuse', true);
  END;

  INSERT INTO ecomfy_payments(internal_reference,order_id,shop_id,amount,status,updated_at) VALUES
    ('ECM-PAY-AAAAAAAAAAAA',o1,s,1000,'SUCCEEDED',now()-interval '1 hour'),
    ('ECM-PAY-BBBBBBBBBBBB',o3,s,1000,'SUCCEEDED',now()-interval '1 hour');
  UPDATE orders SET payment_status='paid' WHERE id=o3;
  -- o3 a une ligne 'sending' creee plus haut ? non : pas encore. Ligne absente => listee.
  SELECT count(*) INTO n FROM list_purchases_to_resend();
  PERFORM pg_temp.chk('reprise : seul le paiement jamais envoye est liste', n=1, n::text);
  UPDATE ecomfy_payments SET updated_at=now() WHERE internal_reference='ECM-PAY-BBBBBBBBBBBB';
  SELECT count(*) INTO n FROM list_purchases_to_resend();
  PERFORM pg_temp.chk('reprise : delai de grace de 2 min', n=0, n::text);
  UPDATE ecomfy_payments SET updated_at=now()-interval '5 days' WHERE internal_reference='ECM-PAY-BBBBBBBBBBBB';
  SELECT count(*) INTO n FROM list_purchases_to_resend();
  PERFORM pg_temp.chk('reprise : fenetre de 72 h', n=0, n::text);
  UPDATE ecomfy_payments SET updated_at=now()-interval '1 hour' WHERE internal_reference='ECM-PAY-BBBBBBBBBBBB';
  PERFORM claim_purchase_send(s,o3,'ord_CMD-3');
  PERFORM finish_purchase_send(s,o3,'failed',ARRAY[]::text[],'x');
  SELECT count(*) INTO n FROM list_purchases_to_resend();
  PERFORM pg_temp.chk('reprise : echec liste', n=1, n::text);
  UPDATE tracking_purchase_log SET attempts=5 WHERE order_id=o3;
  SELECT count(*) INTO n FROM list_purchases_to_resend();
  PERFORM pg_temp.chk('reprise : 5 tentatives max', n=0, n::text);
  UPDATE tracking_purchase_log SET status='failed', attempts=1 WHERE order_id=o3;
  UPDATE orders SET order_status='cancelled' WHERE id=o3;
  SELECT count(*) INTO n FROM list_purchases_to_resend();
  PERFORM pg_temp.chk('reprise : commande annulee ignoree', n=0, n::text);

  r := get_payment_return_status('ECM-PAY-AAAAAAAAAAAA');
  PERFORM pg_temp.chk('retour : paye, numero et slug rendus', (r->>'paid')::bool AND r->>'order_number'='CMD-1' AND r->>'shop_slug'='boutique', r::text);
  r := get_payment_return_status('ECM-PAY-ZZZZZZZZZZZZ');
  PERFORM pg_temp.chk('retour : reference inconnue', NOT (r->>'found')::bool, r::text);
  PERFORM pg_temp.chk('retour : reference mal formee ou NULL', NOT (get_payment_return_status('x'' OR 1=1')->>'found')::bool AND NOT (get_payment_return_status(NULL)->>'found')::bool);
  UPDATE ecomfy_payments SET status='PENDING' WHERE internal_reference='ECM-PAY-AAAAAAAAAAAA';
  r := get_payment_return_status('ECM-PAY-AAAAAAAAAAAA');
  PERFORM pg_temp.chk('retour : en attente = non paye', (r->>'found')::bool AND NOT (r->>'paid')::bool, r::text);

  PERFORM pg_temp.chk('droits : claim reserve au serveur', NOT has_function_privilege('anon','claim_purchase_send(uuid,uuid,text,text)','EXECUTE') AND NOT has_function_privilege('authenticated','claim_purchase_send(uuid,uuid,text,text)','EXECUTE'));
  PERFORM pg_temp.chk('droits : finish et list reserves au serveur', NOT has_function_privilege('anon','finish_purchase_send(uuid,uuid,text,text[],text)','EXECUTE') AND NOT has_function_privilege('authenticated','list_purchases_to_resend(integer,integer)','EXECUTE'));
  PERFORM pg_temp.chk('droits : retour de paiement ouvert a anon', has_function_privilege('anon','get_payment_return_status(text)','EXECUTE'));
  PERFORM pg_temp.chk('droits : registre en lecture seule', has_table_privilege('authenticated','tracking_purchase_log','SELECT') AND NOT has_table_privilege('authenticated','tracking_purchase_log','INSERT') AND NOT has_table_privilege('authenticated','tracking_purchase_log','UPDATE') AND NOT has_table_privilege('anon','tracking_purchase_log','SELECT'));

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', u::text, true);
  SELECT count(*) INTO n FROM tracking_purchase_log;
  PERFORM pg_temp.chk('RLS : le proprietaire voit son registre', n>=2, n::text);
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  SELECT count(*) INTO n FROM tracking_purchase_log;
  PERFORM pg_temp.chk('RLS : un autre utilisateur ne voit rien', n=0, n::text);
  RESET ROLE;
END $$;
SELECT label, ok, detail FROM _t WHERE NOT ok ORDER BY n;
SELECT count(*) AS total, count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS echecs FROM _t;
