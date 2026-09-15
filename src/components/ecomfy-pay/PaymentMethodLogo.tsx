import React from "react";

interface PaymentMethodLogoProps {
  id: string;
  size?: number; // width/height in px
  className?: string;
}

export const PaymentMethodLogo: React.FC<PaymentMethodLogoProps> = ({
  id,
  size = 44,
  className = "",
}) => {
  switch (id.toLowerCase()) {
    case "wave":
    case "wave_money":
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-[#1DC3F5] flex items-center justify-center shadow-sm shrink-0 overflow-hidden relative border border-cyan-400/30 ${className}`}
          title="Wave Mobile Money"
        >
          {/* Logo SVG Pingouin Wave Authentique */}
          <svg viewBox="0 0 100 100" className="w-full h-full p-1">
            <path
              d="M50 12 C32 12 22 28 22 52 C22 72 32 88 50 88 C68 88 78 72 78 52 C78 28 68 12 50 12 Z"
              fill="#1B2B4A"
            />
            <path
              d="M50 32 C40 32 32 44 32 64 C32 80 40 84 50 84 C60 84 68 80 68 64 C68 44 60 32 50 32 Z"
              fill="#FFFFFF"
            />
            <circle cx="43" cy="30" r="3" fill="#FFFFFF" />
            <circle cx="57" cy="30" r="3" fill="#FFFFFF" />
            <circle cx="44" cy="30" r="1.5" fill="#1B2B4A" />
            <circle cx="56" cy="30" r="1.5" fill="#1B2B4A" />
            <polygon points="50,34 43,42 57,42" fill="#FFC107" />
            <ellipse cx="40" cy="86" rx="5" ry="3" fill="#FF9800" />
            <ellipse cx="60" cy="86" rx="5" ry="3" fill="#FF9800" />
          </svg>
        </div>
      );

    case "orange":
    case "orange_money":
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-[#FF6600] flex flex-col items-center justify-center p-1 text-white shadow-sm shrink-0 overflow-hidden font-sans border border-orange-700 ${className}`}
          title="Orange Money"
        >
          {/* Logo Officiel Orange Money sur Fond Orange Vif avec bloc Noir */}
          <div className="w-full h-full bg-black rounded-xl p-1 flex flex-col items-center justify-center border border-orange-400/40">
            <div className="w-3.5 h-3.5 bg-[#FF6600] mb-0.5 rounded-xs" />
            <span className="text-[10px] font-black text-white uppercase tracking-tight leading-none">
              orange
            </span>
            <span className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest leading-none mt-0.5">
              MONEY
            </span>
          </div>
        </div>
      );

    case "mtn":
    case "mtn_momo":
    case "momo":
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-[#FFCC00] flex flex-col items-center justify-center text-[#002B49] shadow-sm shrink-0 overflow-hidden font-extrabold border border-yellow-400 p-1 ${className}`}
          title="MTN Mobile Money"
        >
          <div className="border-2 border-[#002B49] rounded-full px-2 py-0.5 flex flex-col items-center justify-center bg-[#FFCC00]">
            <span className="text-[11px] font-black tracking-tighter leading-none text-[#002B49]">
              MoMo
            </span>
          </div>
          <span className="text-[7px] font-black text-[#002B49] uppercase tracking-tighter mt-0.5">
            MTN MONEY
          </span>
        </div>
      );

    case "moov":
    case "moov_money":
    case "flooz":
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-[#005C9E] flex flex-col items-center justify-center text-white shadow-sm shrink-0 overflow-hidden font-extrabold border border-blue-600 p-1 ${className}`}
          title="Moov Money (Flooz)"
        >
          <span className="text-[11px] font-black tracking-tighter text-white leading-none">
            Moov
          </span>
          <div className="bg-[#F37023] px-1.5 py-0.5 rounded text-[7px] font-black text-white uppercase tracking-wider mt-0.5 leading-none">
            Money
          </div>
        </div>
      );

    case "card":
    case "visa":
    case "mastercard":
    case "stripe":
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-white shadow-sm shrink-0 overflow-hidden border border-slate-700 p-1 ${className}`}
          title="Visa & Mastercard"
        >
          <div className="flex items-center justify-center gap-1 w-full">
            <span className="text-[10px] font-black italic text-blue-400 tracking-tighter">
              VISA
            </span>
            <div className="flex -space-x-1 items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-90" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-90" />
            </div>
          </div>
          <span className="text-[7px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">
            CARTE
          </span>
        </div>
      );

    case "djamo":
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-[#0A0E17] flex flex-col items-center justify-center text-white shadow-sm shrink-0 overflow-hidden border border-slate-800 p-1 ${className}`}
          title="Djamo"
        >
          <div className="flex items-center gap-0.5">
            <span className="text-[11px] font-black tracking-tighter text-[#00D2FF] font-sans">
              djamo
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00D2FF]" />
          </div>
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            PAY
          </span>
        </div>
      );

    case "cinetpay":
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-[#1D3557] flex flex-col items-center justify-center text-white shadow-sm shrink-0 overflow-hidden p-1 ${className}`}
          title="CinetPay"
        >
          <span className="text-[10px] font-black tracking-tight text-[#45B69C]">
            Cinet<span className="text-white">Pay</span>
          </span>
        </div>
      );

    default:
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold shrink-0 ${className}`}
        >
          💳
        </div>
      );
  }
};
