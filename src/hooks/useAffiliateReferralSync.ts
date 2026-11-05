import { useEffect, useRef } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { affiliateService } from "@/services/affiliateService";
import { captureAffiliateRefFromUrl } from "@/lib/affiliateRef";

/**
 * Attaches the logged-in account to the affiliate whose link brought it here, whichever way it signed in
 * (password, e-mail confirmation link, Google). Also keeps the code of any `?ref=` link opened on the site.
 */
export const useAffiliateReferralSync = () => {
  const { user, isReady } = useAuthReady();
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    captureAffiliateRefFromUrl();
  }, []);

  useEffect(() => {
    if (!isReady || !user?.id || syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;

    const metaCode = typeof user.user_metadata?.referral_code === "string" ? user.user_metadata.referral_code : null;
    affiliateService.checkAndRecordPendingReferral(user.id, user.email, metaCode).catch((err) => {
      console.error("Error syncing affiliate referral:", err);
    });
  }, [isReady, user?.id, user?.email, user?.user_metadata]);
};
