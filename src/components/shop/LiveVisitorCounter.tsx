import { useEffect, useState } from "react";
import { Users } from "lucide-react";

export function LiveVisitorCounter({
  enabled,
  minVisitors = 12,
  maxVisitors = 45,
  color = "#dc2626", // default red-600
}: {
  enabled: boolean;
  minVisitors?: number;
  maxVisitors?: number;
  color?: string;
}) {
  const [visitors, setVisitors] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // Initial random value
    setVisitors(Math.floor(Math.random() * (maxVisitors - minVisitors + 1)) + minVisitors);

    // Fluctuate every few seconds
    const interval = setInterval(() => {
      setVisitors((prev) => {
        // Change by -3 to +3
        const change = Math.floor(Math.random() * 7) - 3;
        let next = prev + change;
        if (next < minVisitors) next = minVisitors;
        if (next > maxVisitors) next = maxVisitors;
        return next;
      });
    }, 5000 + Math.random() * 3000); // randomize interval a bit

    return () => clearInterval(interval);
  }, [enabled, minVisitors, maxVisitors]);

  if (!enabled || visitors === 0) return null;

  return (
    <div 
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold mb-3 border"
      style={{ backgroundColor: `${color}15`, color: color, borderColor: `${color}30` }}
    >
      <div className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }}></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }}></span>
      </div>
      <Users className="h-4 w-4" />
      <span>{visitors} personnes regardent ce produit</span>
    </div>
  );
}
