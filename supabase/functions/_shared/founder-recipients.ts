// Destinataires des alertes « fondateur » : lus dans public.user_roles (founder, co_founder), jamais en dur.
// Transférer ou ajouter un fondateur = changer son rôle (manage-founder-roles), sans déploiement.

// Client minimal exigé : le client service_role de supabase-js convient, un faux client de test aussi.
export interface FounderRecipientsClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- client Supabase de service sans types générés
  from(table: string): any;
  auth: { admin: { getUserById(id: string): Promise<{ data: { user: { email?: string | null } | null } | null; error?: unknown }> } };
}

/** E-mails (minuscules, sans doublon) des comptes ayant le rôle founder ou co_founder. Liste vide si aucun. */
export async function getFounderEmails(admin: FounderRecipientsClient): Promise<string[]> {
  const { data, error } = await admin.from("user_roles").select("user_id").in("role", ["founder", "co_founder"]);
  if (error) {
    console.error("[founder-recipients] lecture des rôles impossible", error);
    return [];
  }
  const ids = [...new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))];
  const emails = new Set<string>();
  for (const id of ids) {
    try {
      const { data: res } = await admin.auth.admin.getUserById(id);
      const email = res?.user?.email?.trim().toLowerCase();
      if (email) emails.add(email);
    } catch (e) {
      console.error("[founder-recipients] compte illisible", id, e);
    }
  }
  return [...emails];
}
