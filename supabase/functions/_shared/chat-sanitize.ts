// Nettoyage de l'historique de chat fourni par un visiteur (H9). Aucune dépendance : testable avec Node.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Nettoie l'historique envoyé par un visiteur : seuls les rôles `user` et `assistant` passent
 * (un message `system` fourni par le client écraserait les consignes de la boutique), les
 * contenus sont tronqués, et seuls les derniers messages sont gardés. Le dernier message
 * retenu doit venir de l'utilisateur.
 */
export function sanitizeChatMessages(
  input: unknown,
  maxMessages = 12,
  maxChars = 1000,
): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const clean: ChatMessage[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, maxChars);
    if (!text) continue;
    clean.push({ role, content: text });
  }
  const tail = clean.slice(-maxMessages);
  while (tail.length > 0 && tail[0].role !== "user") tail.shift();
  return tail[tail.length - 1]?.role === "user" ? tail : [];
}
