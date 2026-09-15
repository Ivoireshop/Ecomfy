import React from "react";
import { FooterCustomSectionSettings } from "../types";
import { ShieldCheck, Truck, Phone, MessageCircle } from "lucide-react";

interface FooterCustomSectionProps {
  settings: FooterCustomSectionSettings;
  shopName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

export const FooterCustomSection: React.FC<FooterCustomSectionProps> = ({
  settings,
  shopName = "Boutique",
  logoUrl,
  primaryColor = "#0E7C66",
}) => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 px-4 sm:px-6 lg:px-8 mt-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-slate-800">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={shopName} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {shopName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="font-space font-bold text-lg text-white">{shopName}</span>
          </div>
          {settings.business_description && (
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {settings.business_description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-white uppercase tracking-wider">
            Engagements Client
          </h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>Livraison rapide & suivie</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Paiement 100% sécurisé à la livraison</span>
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Service client réactif sur WhatsApp</span>
            </li>
          </ul>
        </div>

        {settings.show_social_links && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-white uppercase tracking-wider">
              Rester en contact
            </h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {settings.whatsapp_number && (
                <a
                  href={`https://wa.me/${settings.whatsapp_number.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-medium hover:bg-emerald-600/30 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
              {settings.facebook_url && (
                <a
                  href={settings.facebook_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 font-medium hover:bg-blue-600/30 transition-colors"
                >
                  Facebook
                </a>
              )}
              {settings.instagram_url && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-pink-600/20 text-pink-400 border border-pink-500/30 flex items-center gap-1.5 font-medium hover:bg-pink-600/30 transition-colors"
                >
                  Instagram
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>{settings.copyright_text || `© ${new Date().getFullYear()} ${shopName}. Tous droits réservés.`}</p>

        {settings.show_payment_badges && (
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">Paiement à la livraison</span>
            <span className="px-2 py-1 bg-slate-800 rounded text-amber-400">Mobile Money</span>
            <span className="px-2 py-1 bg-slate-800 rounded text-blue-400">Carte Bancaire</span>
          </div>
        )}
      </div>
    </footer>
  );
};
