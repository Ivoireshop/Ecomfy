import React from "react";

interface PaymentMethodLogoProps {
  id: string;
  size?: number; // width/height in px
  className?: string;
}

interface Mark {
  name: string;
  background: string;
  art: React.ReactNode;
}

const FONT = "Arial, Helvetica, sans-serif";

/** Texte centré dans le dessin ; `width` impose sa largeur pour qu'il ne déborde dans aucune police. */
const Word = ({ y, size, width, fill, italic, children }: {
  y: number; size: number; width: number; fill: string; italic?: boolean; children: React.ReactNode;
}) => (
  <text x="50" y={y} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={size} fill={fill}
    fontStyle={italic ? "italic" : undefined} textLength={width} lengthAdjust="spacingAndGlyphs">
    {children}
  </text>
);

const WAVE: Mark = {
  name: "Wave Mobile Money",
  background: "#1DC3F5",
  art: (
    <>
      <path d="M50 14 C33 14 24 29 24 51 C24 70 34 85 50 85 C66 85 76 70 76 51 C76 29 67 14 50 14 Z" fill="#1B2B4A" />
      <path d="M50 33 C41 33 34 45 34 63 C34 78 41 82 50 82 C59 82 66 78 66 63 C66 45 59 33 50 33 Z" fill="#FFFFFF" />
      <circle cx="43" cy="30" r="3.5" fill="#FFFFFF" />
      <circle cx="57" cy="30" r="3.5" fill="#FFFFFF" />
      <circle cx="44" cy="30" r="1.8" fill="#1B2B4A" />
      <circle cx="56" cy="30" r="1.8" fill="#1B2B4A" />
      <polygon points="50,43 43,35 57,35" fill="#FFC107" />
      <ellipse cx="40" cy="85" rx="6" ry="3.5" fill="#FF9800" />
      <ellipse cx="60" cy="85" rx="6" ry="3.5" fill="#FF9800" />
    </>
  ),
};

const ORANGE: Mark = {
  name: "Orange Money",
  background: "#000000",
  art: (
    <>
      <rect x="36" y="14" width="28" height="28" rx="3" fill="#FF6600" />
      <Word y={66} size={24} width={74} fill="#FFFFFF">orange</Word>
      <Word y={85} size={17} width={66} fill="#FF6600">MONEY</Word>
    </>
  ),
};

const MTN: Mark = {
  name: "MTN Mobile Money",
  background: "#FFCC00",
  art: (
    <>
      <ellipse cx="50" cy="39" rx="38" ry="21" fill="none" stroke="#002B49" strokeWidth="5" />
      <Word y={48} size={25} width={50} fill="#002B49">MTN</Word>
      <Word y={84} size={24} width={60} fill="#002B49">MoMo</Word>
    </>
  ),
};

const MOOV: Mark = {
  name: "Moov Money (Flooz)",
  background: "#005C9E",
  art: (
    <>
      <Word y={49} size={32} width={76} fill="#FFFFFF">Moov</Word>
      <rect x="14" y="58" width="72" height="24" rx="6" fill="#F37023" />
      <Word y={76} size={17} width={58} fill="#FFFFFF">MONEY</Word>
    </>
  ),
};

const CARD: Mark = {
  name: "Carte bancaire (Visa, Mastercard)",
  background: "#0F172A",
  art: (
    <>
      <Word y={44} size={32} width={68} fill="#60A5FA" italic>VISA</Word>
      <circle cx="40" cy="68" r="14" fill="#EF4444" />
      <circle cx="60" cy="68" r="14" fill="#FBBF24" fillOpacity="0.9" />
    </>
  ),
};

const DJAMO: Mark = {
  name: "Djamo",
  background: "#0A0E17",
  art: <Word y={60} size={28} width={76} fill="#00D2FF">djamo</Word>,
};

const CINETPAY: Mark = {
  name: "CinetPay",
  background: "#1D3557",
  art: (
    <>
      <Word y={48} size={26} width={70} fill="#45B69C">Cinet</Word>
      <Word y={76} size={26} width={44} fill="#FFFFFF">Pay</Word>
    </>
  ),
};

const MOBILE_MONEY: Mark = {
  name: "Mobile Money",
  background: "#0E7C66",
  art: (
    <>
      <rect x="32" y="16" width="36" height="68" rx="7" fill="none" stroke="#FFFFFF" strokeWidth="6" />
      <rect x="43" y="71" width="14" height="5" rx="2.5" fill="#FFFFFF" />
      <Word y={55} size={22} width={18} fill="#FFFFFF">F</Word>
    </>
  ),
};

const BANK: Mark = {
  name: "Virement bancaire",
  background: "#334155",
  art: (
    <g fill="#FFFFFF">
      <polygon points="50,16 84,36 16,36" />
      <rect x="23" y="43" width="9" height="28" />
      <rect x="45.5" y="43" width="9" height="28" />
      <rect x="68" y="43" width="9" height="28" />
      <rect x="16" y="76" width="68" height="8" rx="2" />
    </g>
  ),
};

const OTHER: Mark = {
  name: "Paiement",
  background: "#E2E8F0",
  art: (
    <>
      <rect x="18" y="28" width="64" height="44" rx="7" fill="none" stroke="#334155" strokeWidth="6" />
      <rect x="18" y="39" width="64" height="9" fill="#334155" />
    </>
  ),
};

const MARKS: Record<string, Mark> = {
  wave: WAVE,
  wave_money: WAVE,
  orange: ORANGE,
  orange_money: ORANGE,
  mtn: MTN,
  mtn_momo: MTN,
  mtn_money: MTN,
  momo: MTN,
  moov: MOOV,
  moov_money: MOOV,
  flooz: MOOV,
  card: CARD,
  visa: CARD,
  mastercard: CARD,
  stripe: CARD,
  djamo: DJAMO,
  cinetpay: CINETPAY,
  mobile_money: MOBILE_MONEY,
  bank_transfer: BANK,
};

/** Dessin vectoriel : il reste entier et net à toutes les tailles. */
export const PaymentMethodLogo: React.FC<PaymentMethodLogoProps> = ({ id, size = 44, className = "" }) => {
  const mark = MARKS[id.toLowerCase()] ?? OTHER;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={mark.name}
      className={`shrink-0 ${className}`}>
      <title>{mark.name}</title>
      <rect width="100" height="100" rx="24" fill={mark.background} />
      {mark.art}
    </svg>
  );
};

const NETWORKS = ["orange_money", "mtn_momo", "wave", "moov_money", "card"];

/** Rangée des moyens de paiement acceptés, pour les écrans de paiement. */
export const PaymentNetworks: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
  <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
    {NETWORKS.map((id) => <PaymentMethodLogo key={id} id={id} size={size} />)}
  </div>
);
