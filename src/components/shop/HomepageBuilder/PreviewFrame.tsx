import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PreviewFrameProps {
  /** Largeur de l'appareil simulé, en pixels. */
  width: number;
  title: string;
  children: React.ReactNode;
}

/**
 * Aperçu à la largeur d'un appareil, réduit pour tenir dans la place disponible.
 * Le contenu est rendu dans un cadre (iframe) : les points de rupture CSS suivent ainsi la largeur simulée, et non celle
 * de la fenêtre — sans cela une grille « 4 colonnes sur ordinateur » s'écrasait dans un aperçu étroit ou mobile.
 */
export const PreviewFrame: React.FC<PreviewFrameProps> = ({ width, title, children }) => {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!host) return;
    const measure = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [host]);

  // Les feuilles de style de l'application sont recopiées dans le cadre, puis suivies (styles chargés à la demande).
  useEffect(() => {
    if (!body) return;
    const target = body.ownerDocument;
    const sync = () => {
      const previous = Array.from(target.head.querySelectorAll("[data-preview-style]"));
      document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        const copy = node.cloneNode(true) as Element;
        copy.setAttribute("data-preview-style", "");
        target.head.appendChild(copy);
      });
      // Les anciennes copies partent après l'ajout des nouvelles : l'aperçu ne clignote pas sans style.
      previous.forEach((node) => node.remove());
      target.documentElement.className = document.documentElement.className;
      body.className = document.body.className;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [body]);

  const scale = size.width > 0 ? Math.min(1, size.width / width) : 1;

  return (
    <div ref={setHost} className="relative h-full w-full overflow-hidden">
      <iframe
        title={title}
        srcDoc="<!doctype html><html><head></head><body></body></html>"
        onLoad={(event) => setBody(event.currentTarget.contentDocument?.body ?? null)}
        className="absolute top-0 border-0 origin-top-left"
        style={{
          width,
          // La feuille de style du site limite les iframes à la largeur disponible : le cadre perdrait sa largeur simulée.
          maxWidth: "none",
          height: size.height / scale,
          left: Math.max(0, (size.width - width * scale) / 2),
          transform: `scale(${scale})`,
        }}
      />
      {body && createPortal(
        // Un lien suivi dans l'aperçu remplacerait celui-ci par une autre page.
        <div onClickCapture={(event) => { if ((event.target as Element).closest?.("a[href]")) event.preventDefault(); }}>
          {children}
        </div>,
        body,
      )}
    </div>
  );
};
