import React, { useEffect, useState, useRef } from "react";
import Globe from "react-globe.gl";
import { cn } from "@/lib/utils";
import * as THREE from "three";

export interface TrafficGlobeProps {
  markers: { location: [number, number], size: number, name: string, color?: string }[];
  className?: string;
  themeColor?: string;
}

export function TrafficGlobe({ markers, className, themeColor = "#0f172a" }: TrafficGlobeProps) {
  const [countries, setCountries] = useState({ features: [] });
  const globeEl = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 350, height: 350 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Create a blinking style
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes globe-blink {
        0% { opacity: 0.2; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.2); }
        100% { opacity: 0.2; transform: scale(0.8); }
      }
      .globe-marker-blinking {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: var(--marker-color, ${themeColor});
        box-shadow: 0 0 10px var(--marker-color, ${themeColor});
        animation: globe-blink 1.5s infinite ease-in-out;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [themeColor]);

  useEffect(() => {
    // Resize observer to make the globe responsive
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height: Math.min(height, width) });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Load country polygons data
    fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then(res => res.json())
      .then(worldData => {
        // We need topojson to convert this to geojson if it's topojson, 
        // wait, world-atlas provides topojson. Let's use a direct geojson instead to avoid adding topojson dependency.
        fetch("https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson")
          .then(res => res.json())
          .then(setCountries);
      }).catch(() => {
        fetch("https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson")
          .then(res => res.json())
          .then(setCountries);
      });
  }, []);

  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1;
      controls.enableZoom = false; // Disable zoom for a cleaner look
      
      // Center roughly on Africa since it's the primary market for the user
      globeEl.current.pointOfView({ lat: 5, lng: 20, altitude: 2 });
    }
  }, [globeEl.current]);

  const ringsData = markers.map(m => ({
    lat: m.location[0],
    lng: m.location[1],
    maxR: Math.max(m.size * 20, 5), // Size adjustment
    propagationSpeed: 1,
    repeatPeriod: 1000,
    name: m.name,
    color: m.color
  }));

  const hexColor = themeColor;

  return (
    <div ref={containerRef} className={cn("relative w-full h-full flex items-center justify-center overflow-hidden", className)}>
      {dimensions.width > 0 && (
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)" // Transparent
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-water.png"
          polygonsData={countries.features}
          polygonAltitude={0.01}
          polygonCapColor={() => "#f1f5f9"} // Slate-100 for countries
          polygonSideColor={() => "rgba(255, 255, 255, 0.1)"}
          polygonStrokeColor={() => "#cbd5e1"} // Slate-300 for borders
          
          ringsData={ringsData}
          ringColor={(d: any) => d.color || hexColor}
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          
          labelsData={markers}
          labelLat={d => (d as any).location[0]}
          labelLng={d => (d as any).location[1]}
          labelText={d => (d as any).name}
          labelSize={d => (d as any).size * 5 + 1.5}
          labelDotRadius={1}
          labelColor={(d: any) => d.color || hexColor}
          labelResolution={2}
          labelAltitude={0.02}
          
          htmlElementsData={markers}
          htmlLat={d => (d as any).location[0]}
          htmlLng={d => (d as any).location[1]}
          htmlElement={d => {
            const el = document.createElement('div');
            el.className = 'globe-marker-blinking';
            if ((d as any).color) {
              el.style.setProperty('--marker-color', (d as any).color);
            }
            return el;
          }}
          htmlAltitude={0.03}
        />
      )}
    </div>
  );
}
