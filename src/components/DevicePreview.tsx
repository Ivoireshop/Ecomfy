import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smartphone, Tablet, Monitor, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface DevicePreviewProps {
  url: string;
  className?: string;
}

type DeviceType = 'iphone' | 'android' | 'tablet' | 'desktop';

const devices = {
  iphone: {
    name: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    icon: Smartphone,
    notch: true,
  },
  android: {
    name: 'Samsung Galaxy S23',
    width: 360,
    height: 800,
    icon: Smartphone,
    notch: false,
  },
  tablet: {
    name: 'iPad Pro',
    width: 768,
    height: 1024,
    icon: Tablet,
    notch: false,
  },
  desktop: {
    name: 'Desktop',
    width: 1440,
    height: 900,
    icon: Monitor,
    notch: false,
  },
};

export function DevicePreview({ url, className }: DevicePreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>('iphone');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [refreshKey, setRefreshKey] = useState(0);

  const device = devices[selectedDevice];
  const isPortrait = orientation === 'portrait';
  const frameWidth = isPortrait ? device.width : device.height;
  const frameHeight = isPortrait ? device.height : device.width;

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className={cn("flex flex-col items-center gap-6 p-6", className)}>
      {/* Device Selector */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(Object.keys(devices) as DeviceType[]).map((deviceType) => {
          const DeviceIcon = devices[deviceType].icon;
          return (
            <Button
              key={deviceType}
              variant={selectedDevice === deviceType ? 'default' : 'outline'}
              onClick={() => setSelectedDevice(deviceType)}
              className="gap-2"
              size="sm"
            >
              <DeviceIcon className="h-4 w-4" />
              {devices[deviceType].name}
            </Button>
          );
        })}
      </div>

      {/* Orientation Toggle & Refresh (except for desktop) */}
      <div className="flex gap-2 items-center">
        {selectedDevice !== 'desktop' && (
          <>
            <Button
              variant={orientation === 'portrait' ? 'default' : 'outline'}
              onClick={() => setOrientation('portrait')}
              size="sm"
            >
              Portrait
            </Button>
            <Button
              variant={orientation === 'landscape' ? 'default' : 'outline'}
              onClick={() => setOrientation('landscape')}
              size="sm"
            >
              Paysage
            </Button>
          </>
        )}
        <Button
          variant="outline"
          onClick={handleRefresh}
          size="sm"
          className="gap-2"
        >
          <RotateCw className="h-4 w-4" />
          Rafraîchir
        </Button>
      </div>

      {/* Device Frame */}
      <div className="w-full flex justify-center overflow-auto">
        <Card 
          className="relative overflow-hidden shadow-2xl bg-slate-900 flex-shrink-0"
          style={{
            width: selectedDevice === 'desktop' ? '100%' : `${frameWidth}px`,
            maxWidth: selectedDevice === 'desktop' ? '100%' : `${frameWidth}px`,
          }}
        >
          {/* iPhone Notch */}
          {device.notch && isPortrait && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-40 h-7 bg-slate-900 rounded-b-3xl" />
          )}

          {/* Screen */}
          <div 
            className="relative bg-white overflow-hidden"
            style={{
              height: selectedDevice === 'desktop' ? '70vh' : `${frameHeight}px`,
            }}
          >
            <iframe
              key={refreshKey}
              src={url}
              className="w-full h-full border-0"
              title="Device Preview"
              loading="lazy"
            />
          </div>

          {/* Device Buttons (for mobile/tablet) */}
          {selectedDevice !== 'desktop' && (
            <>
              {/* Power button */}
              <div className="absolute right-0 top-32 w-1 h-16 bg-slate-800 rounded-l" />
              {/* Volume buttons */}
              <div className="absolute left-0 top-24 w-1 h-12 bg-slate-800 rounded-r" />
              <div className="absolute left-0 top-40 w-1 h-12 bg-slate-800 rounded-r" />
            </>
          )}
        </Card>
      </div>

      {/* Device Info */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p className="font-medium">{device.name}</p>
        <p className="text-xs">
          {frameWidth}px × {frameHeight}px {orientation === 'landscape' && '(Paysage)'}
        </p>
        <p className="text-xs opacity-70">
          💡 La prévisualisation reflète les modifications sauvegardées
        </p>
      </div>
    </div>
  );
}