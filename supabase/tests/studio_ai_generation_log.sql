-- Test de comportement de start_studio_generation / finish_studio_generation / expire_stale_studio_generations
-- (migration 20261103100000). Base de DEV uniquement : modifie temporairement les crédits d'un profil existant,
-- exerce réservation, remboursement, plafond, exemption, balayage et droits, puis se termine par RAISE EXCEPTION
-- portant le rapport : tout est annulé.
-- Lancer : supabase db query --linked --project-ref <réf. DEV> -f supabase/tests/studio_ai_generation_log.sql
--          (attendu : « (0 échecs) »). Ne JAMAIS pointer la prod : `--linked` seul vise le projet lié, vérifier d'abord
--          `cat supabase/.temp/linked-project.json`.
-- Prérequis : un profil sans rôle fondateur ni abonnement actif.

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

DO $$
DECLARE
    u uuid; r jsonb; l1 uuid; l2 uuid; l3 uuid; lv uuid; lf uuid; ls uuid;
    p public.profiles; v_err text; v_n int;
BEGIN
    SELECT pr.id INTO u FROM public.profiles pr
     WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = pr.id AND ur.role IN ('founder', 'co_founder'))
       AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = pr.id AND s.status = 'active')
     LIMIT 1;
    PERFORM pg_temp.chk('contexte : un profil sans exemption', u IS NOT NULL, 'user=' || COALESCE(u::text, 'aucun'));

    UPDATE public.profiles SET free_generations_remaining = 1, free_video_generations_remaining = 0, purchased_credits = 2 WHERE id = u;
    DELETE FROM public.ai_generation_log WHERE user_id = u;

    -- 1. Image : essai gratuit d'abord
    r := public.start_studio_generation(u, 'image', 5, 1);
    l1 := (r->>'log_id')::uuid;
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('image 1 : essai gratuit débité', (r->>'success')::bool AND r->>'source' = 'free' AND p.free_generations_remaining = 0 AND p.purchased_credits = 2, r::text);

    -- 2. Puis crédits achetés (1 par image)
    r := public.start_studio_generation(u, 'image', 5, 1);
    l2 := (r->>'log_id')::uuid;
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('image 2 : 1 crédit débité', r->>'source' = 'credits' AND p.purchased_credits = 1, r::text);
    r := public.start_studio_generation(u, 'image', 5, 1);
    l3 := (r->>'log_id')::uuid;
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('image 3 : dernier crédit débité', r->>'source' = 'credits' AND p.purchased_credits = 0, r::text);

    -- 3. Plus rien : refus, aucune ligne créée, aucun solde négatif (le bug d'origine : générer à zéro crédit)
    SELECT count(*) INTO v_n FROM public.ai_generation_log WHERE user_id = u;
    r := public.start_studio_generation(u, 'image', 5, 1);
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('image 4 : refusée à zéro crédit (credits_required), solde intact',
        NOT (r->>'success')::bool AND r->>'error' = 'credits_required' AND p.purchased_credits = 0
        AND (SELECT count(*) FROM public.ai_generation_log WHERE user_id = u) = v_n, r::text);

    -- 4. Échec : remboursement, une seule fois
    r := public.finish_studio_generation(l3, 'failed', 3, 'gpt-image-1', 0.02, 4000, 'rate_limited');
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('échec : crédit rendu', (r->>'refunded')::bool AND p.purchased_credits = 1, r::text);
    r := public.finish_studio_generation(l3, 'failed', 3, 'gpt-image-1', 0.02, 4000, 'rate_limited');
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('échec rejoué : aucun second remboursement', NOT (r->>'success')::bool AND p.purchased_credits = 1, r::text);
    r := public.finish_studio_generation(l3, 'succeeded', 1, 'x', 0.2, 1, NULL);
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('une ligne déjà clôturée ne peut pas être « réussie » après coup', NOT (r->>'success')::bool AND p.purchased_credits = 1, r::text);

    -- 5. Succès : pas de remboursement, coût enregistré
    r := public.finish_studio_generation(l2, 'succeeded', 1, 'gpt-image-1', 0.167, 21000, NULL);
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('succès : pas de remboursement, coût et tentatives enregistrés',
        NOT (r->>'refunded')::bool AND p.purchased_credits = 1
        AND (SELECT estimated_cost_usd = 0.167 AND attempts = 1 AND status = 'succeeded' AND error_code IS NULL FROM public.ai_generation_log WHERE id = l2), r::text);

    -- 6. Échec avec essai gratuit : l'essai est rendu
    UPDATE public.profiles SET free_generations_remaining = 1, purchased_credits = 0 WHERE id = u;
    r := public.start_studio_generation(u, 'image', 50, 1); lf := (r->>'log_id')::uuid;
    r := public.finish_studio_generation(lf, 'failed', 1, NULL, 0, 100, 'content_policy');
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('échec d''un essai gratuit : essai rendu', (r->>'refunded')::bool AND p.free_generations_remaining = 1, r::text);

    -- 7. Vidéo : essai vidéo distinct, puis 3 crédits
    UPDATE public.profiles SET free_video_generations_remaining = 0, purchased_credits = 2 WHERE id = u;
    r := public.start_studio_generation(u, 'video', 50, 3);
    PERFORM pg_temp.chk('vidéo : 2 crédits < 3 requis = refusée', NOT (r->>'success')::bool AND r->>'error' = 'credits_required', r::text);
    UPDATE public.profiles SET purchased_credits = 5 WHERE id = u;
    r := public.start_studio_generation(u, 'video', 50, 3); lv := (r->>'log_id')::uuid;
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('vidéo : 3 crédits débités', r->>'source' = 'credits' AND p.purchased_credits = 2 AND (r->>'charged')::numeric = 3, r::text);
    r := public.finish_studio_generation(lv, 'failed', 2, 'replicate', 0.1, 5000, 'animation_failed');
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('vidéo en échec : 3 crédits rendus', (r->>'refunded')::bool AND p.purchased_credits = 5, r::text);
    PERFORM pg_temp.chk('le coût d''un échec reste dans le journal (dépense réelle)',
        (SELECT estimated_cost_usd = 0.1 AND refunded FROM public.ai_generation_log WHERE id = lv), '');

    -- 8. Plafond de coût du jour (tous profils)
    DELETE FROM public.ai_generation_log WHERE user_id = u;
    INSERT INTO public.ai_generation_log (user_id, feature, status, charge_source, estimated_cost_usd, finished_at)
    VALUES (u, 'image', 'succeeded', 'credits', 5.50, now());
    r := public.start_studio_generation(u, 'image', 5, 1);
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('plafond atteint : refus daily_cost_cap, rien débité', NOT (r->>'success')::bool AND r->>'error' = 'daily_cost_cap' AND p.purchased_credits = 5, r::text);
    r := public.start_studio_generation(u, 'image', 50, 1);
    PERFORM pg_temp.chk('plafond relevé : autorisé', (r->>'success')::bool, r::text);

    -- 9. Exemption fondateur : aucun débit, y compris à zéro crédit, mais le plafond de coût s'applique encore
    DELETE FROM public.ai_generation_log WHERE user_id = u;
    UPDATE public.profiles SET free_generations_remaining = 0, free_video_generations_remaining = 0, purchased_credits = 0 WHERE id = u;
    INSERT INTO public.user_roles (user_id, role) VALUES (u, 'founder');
    r := public.start_studio_generation(u, 'image', 5, 1);
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('fondateur : autorisé à zéro crédit, rien débité', (r->>'success')::bool AND r->>'source' = 'exempt' AND (r->>'charged')::numeric = 0 AND p.purchased_credits = 0, r::text);
    INSERT INTO public.ai_generation_log (user_id, feature, status, charge_source, estimated_cost_usd, finished_at)
    VALUES (u, 'image', 'succeeded', 'exempt', 9, now());
    r := public.start_studio_generation(u, 'image', 5, 1);
    PERFORM pg_temp.chk('fondateur : le plafond de coût s''applique aussi', NOT (r->>'success')::bool AND r->>'error' = 'daily_cost_cap', r::text);
    DELETE FROM public.user_roles WHERE user_id = u AND role = 'founder';

    -- 10. Balayage des réservations abandonnées
    DELETE FROM public.ai_generation_log WHERE user_id = u;
    UPDATE public.profiles SET purchased_credits = 4 WHERE id = u;
    INSERT INTO public.ai_generation_log (user_id, feature, status, charge_source, charge_amount, created_at)
    VALUES (u, 'video', 'reserved', 'credits', 3, now() - interval '31 minutes') RETURNING id INTO ls;
    INSERT INTO public.ai_generation_log (user_id, feature, status, charge_source, charge_amount, created_at)
    VALUES (u, 'video', 'reserved', 'credits', 3, now() - interval '5 minutes');
    v_n := public.expire_stale_studio_generations();
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('balayage : seule la réservation de plus de 30 min est clôturée et remboursée',
        v_n = 1 AND p.purchased_credits = 7
        AND (SELECT status = 'failed' AND refunded AND error_code = 'stale_reservation' FROM public.ai_generation_log WHERE id = ls), 'n=' || v_n || ' solde=' || p.purchased_credits);

    -- 11. Statuts invalides et appels incohérents
    r := public.finish_studio_generation(gen_random_uuid(), 'failed', 0, NULL, 0, NULL, NULL);
    PERFORM pg_temp.chk('clôture d''une ligne inconnue : sans effet', NOT (r->>'success')::bool, r::text);
    r := public.start_studio_generation(u, 'audio', 5, 1);
    PERFORM pg_temp.chk('fonction inconnue refusée', NOT (r->>'success')::bool AND r->>'error' = 'invalid_request', r::text);

    -- 11 bis. Visuels publicitaires et images de service : mêmes règles que l'image du Studio
    DELETE FROM public.ai_generation_log WHERE user_id = u;
    UPDATE public.profiles SET free_generations_remaining = 0, free_video_generations_remaining = 0, purchased_credits = 0 WHERE id = u;
    r := public.start_studio_generation(u, 'ad_visual', 50, 1);
    PERFORM pg_temp.chk('ad_visual : refusé à zéro crédit', NOT (r->>'success')::bool AND r->>'error' = 'credits_required', r::text);
    r := public.start_studio_generation(u, 'feature_image', 50, 1);
    PERFORM pg_temp.chk('feature_image : refusé à zéro crédit', NOT (r->>'success')::bool AND r->>'error' = 'credits_required', r::text);
    UPDATE public.profiles SET free_generations_remaining = 1 WHERE id = u;
    r := public.start_studio_generation(u, 'ad_visual', 50, 1); l1 := (r->>'log_id')::uuid;
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('ad_visual : consomme l''essai gratuit des images', r->>'source' = 'free' AND p.free_generations_remaining = 0
        AND (SELECT feature = 'ad_visual' FROM public.ai_generation_log WHERE id = l1), r::text);
    r := public.finish_studio_generation(l1, 'failed', 3, 'gpt-image-1', 0.01, 900, 'content_policy');
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('ad_visual en échec : essai rendu', (r->>'refunded')::bool AND p.free_generations_remaining = 1, r::text);

    -- Résultat servi depuis le cache / moteur gratuit : crédit rendu, pas compté comme une erreur, coût des appels texte conservé
    r := public.start_studio_generation(u, 'feature_image', 50, 1); l2 := (r->>'log_id')::uuid;
    r := public.finish_studio_generation(l2, 'cancelled', 0, 'cache', 0.02, 800, 'cache_hit');
    SELECT * INTO p FROM public.profiles WHERE id = u;
    PERFORM pg_temp.chk('cancelled : crédit rendu, statut et coût conservés',
        (r->>'refunded')::bool AND p.free_generations_remaining = 1
        AND (SELECT status = 'cancelled' AND refunded AND error_code = 'cache_hit' AND estimated_cost_usd = 0.02 FROM public.ai_generation_log WHERE id = l2), r::text);
    PERFORM pg_temp.chk('la vue de pilotage compte les annulations à part',
        (SELECT sum(cancelled) >= 1 AND sum(failed) >= 1 FROM public.ai_generation_cost_daily WHERE day = (now() AT TIME ZONE 'utc')::date AND feature IN ('ad_visual', 'feature_image')), '');

    -- Fiche produit : enregistrement direct, sans réservation ni débit
    DELETE FROM public.ai_generation_log WHERE user_id = u;
    l3 := public.record_ai_generation(u, 'product_sheet', 'succeeded', 'credits', 1.5, 2, 'gpt-4o', 0.025, 7000, NULL);
    PERFORM pg_temp.chk('record_ai_generation : ligne terminée, coût enregistré, aucun solde touché',
        (SELECT status = 'succeeded' AND charge_amount = 1.5 AND estimated_cost_usd = 0.025 AND finished_at IS NOT NULL AND feature = 'product_sheet' FROM public.ai_generation_log WHERE id = l3), '');
    PERFORM pg_temp.chk('ai_daily_spend_usd : somme du jour', public.ai_daily_spend_usd(u) = 0.025, public.ai_daily_spend_usd(u)::text);
    PERFORM public.record_ai_generation(u, 'product_sheet', 'failed', 'free', 0, 0, NULL, 0, 100, 'ai_unavailable');
    PERFORM pg_temp.chk('fiche en secours : erreur enregistrée sans coût',
        (SELECT count(*) = 1 FROM public.ai_generation_log WHERE user_id = u AND error_code = 'ai_unavailable' AND estimated_cost_usd = 0), '');
    -- La fiche produit compte dans le plafond du jour des autres fonctions
    INSERT INTO public.ai_generation_log (user_id, feature, status, charge_source, estimated_cost_usd, finished_at) VALUES (u, 'product_sheet', 'succeeded', 'free', 5, now());
    UPDATE public.profiles SET free_generations_remaining = 3 WHERE id = u;
    r := public.start_studio_generation(u, 'image', 5, 1);
    PERFORM pg_temp.chk('le coût d''une fiche produit compte dans le plafond d''une image', r->>'error' = 'daily_cost_cap', r::text);
    BEGIN
        INSERT INTO public.ai_generation_log (user_id, feature, status, charge_source) VALUES (u, 'inconnue', 'succeeded', 'free');
        PERFORM pg_temp.chk('fonctionnalité inconnue refusée par la contrainte', false, 'aucune erreur');
    EXCEPTION WHEN check_violation THEN PERFORM pg_temp.chk('fonctionnalité inconnue refusée par la contrainte', true, SQLERRM); END;

    -- 12. Droits : débit de crédits = serveur seulement
    PERFORM pg_temp.chk('record_ai_generation et ai_daily_spend_usd : serveur seulement',
        NOT has_function_privilege('authenticated', 'public.record_ai_generation(uuid,text,text,text,numeric,integer,text,numeric,integer,text)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.ai_daily_spend_usd(uuid)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.ai_daily_spend_usd(uuid)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.record_ai_generation(uuid,text,text,text,numeric,integer,text,numeric,integer,text)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.ai_daily_spend_usd(uuid)', 'EXECUTE'), '');
    PERFORM pg_temp.chk('start_studio_generation : anon/authenticated sans droit, service_role avec',
        NOT has_function_privilege('anon', 'public.start_studio_generation(uuid,text,numeric,numeric)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.start_studio_generation(uuid,text,numeric,numeric)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.start_studio_generation(uuid,text,numeric,numeric)', 'EXECUTE'), '');
    PERFORM pg_temp.chk('finish_studio_generation et le balayage : même règle',
        NOT has_function_privilege('authenticated', 'public.finish_studio_generation(uuid,text,integer,text,numeric,integer,text)', 'EXECUTE')
        AND NOT has_function_privilege('authenticated', 'public.expire_stale_studio_generations()', 'EXECUTE'), '');
    PERFORM pg_temp.chk('journal : lecture seule pour authenticated',
        has_table_privilege('authenticated', 'public.ai_generation_log', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public.ai_generation_log', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public.ai_generation_log', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public.ai_generation_log', 'DELETE')
        AND NOT has_table_privilege('anon', 'public.ai_generation_log', 'SELECT'), '');
    PERFORM pg_temp.chk('journal : RLS active', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_generation_log'::regclass), '');
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    PERFORM pg_temp.chk('ERREUR INATTENDUE', false, v_err);
END;
$$;

DO $$
DECLARE v_report text;
BEGIN
    SELECT string_agg(format('%s %s%s', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, label, CASE WHEN ok AND detail = '' THEN '' ELSE ' — ' || detail END), E'\n' ORDER BY n)
    INTO v_report FROM _t;
    RAISE EXCEPTION E'RAPPORT\n%\n(% échecs)', v_report, (SELECT count(*) FROM _t WHERE NOT ok);
END;
$$;
