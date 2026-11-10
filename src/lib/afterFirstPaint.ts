/**
 * Exécute `fn` juste après le premier affichage de la page, jamais avant.
 *
 * Les pixels publicitaires (Meta, TikTok, Snapchat, Google) téléchargent et exécutent plusieurs centaines de Ko de
 * script. Lancés au moment où la fiche produit se monte, ils occupent le processeur et la bande passante exactement
 * quand l'image principale doit apparaître (mesuré sur mobile émulé : ~0,3 s de processeur et 111 Ko pour le seul
 * pixel Meta, en concurrence avec l'image). Les événements (PageView, ViewContent) partent donc quelques dizaines de
 * millisecondes plus tard, avec le même contenu et le même identifiant d'événement.
 *
 * `requestAnimationFrame` ne s'exécute pas dans un onglet en arrière-plan (ouverture depuis une application, par
 * exemple) : un minuteur de secours garantit que l'événement part quand même, au plus tard après `maxDelayMs`.
 * `fn` n'est exécuté qu'une seule fois.
 */
export function runAfterFirstPaint(fn: () => void, maxDelayMs = 2500): void {
  if (typeof window === "undefined") {
    fn();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    try {
      fn();
    } catch (e) {
      console.warn("[afterFirstPaint] tâche différée en erreur", e);
    }
  };
  // Après le rendu en cours : rAF s'exécute avant la peinture, le setTimeout la laisse se faire.
  requestAnimationFrame(() => setTimeout(run, 0));
  setTimeout(run, maxDelayMs);
}
