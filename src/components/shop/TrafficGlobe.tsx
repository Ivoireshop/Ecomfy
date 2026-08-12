import React, { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { cn } from "@/lib/utils";

export interface TrafficGlobeProps {
  markers: { location: [number, number], size: number }[];
  className?: string;
  themeColor?: string; // Primary color
}

// Convert hex to rgb [r, g, b] where values are 0-1
function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return [r, g, b];
}

export function TrafficGlobe({ markers, className, themeColor = "#3b82f6" }: TrafficGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;

    if (!canvasRef.current) return;

    const markerColor = hexToRgb(themeColor);

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600,
      height: 600,
      phi: 0,
      theta: 0,
      dark: 0, // light theme
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.95, 0.95, 0.95],
      markerColor: markerColor,
      glowColor: [1, 1, 1],
      markers: markers,
      onRender: (state) => {
        // Called on every animation frame.
        // `state` will be an empty object, return updated params.
        state.phi = phi;
        phi += 0.005; // rotation speed
      },
    });

    return () => {
      globe.destroy();
    };
  }, [markers, themeColor]);

  return (
    <div className={cn("relative w-full aspect-square flex items-center justify-center overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", maxWidth: "600px", maxHeight: "600px", contain: "layout paint size" }}
      />
    </div>
  );
}
