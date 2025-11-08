import { Canvas as FabricCanvas, FabricImage, Text, Shadow } from "fabric";

export interface TextOverlayConfig {
  productName: string;
  tagline?: string;
  price?: string;
  promotionalPrice?: string;
  callToAction?: string;
  benefits?: string;
}

/**
 * Creates a Fabric.js canvas with text overlays on top of a background image
 * Returns the final image as a data URL
 */
export const createTextOverlay = async (
  backgroundImageUrl: string,
  config: TextOverlayConfig,
  platform: string = "instagram"
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Create offscreen canvas
    const canvasElement = document.createElement("canvas");
    
    // Platform-specific dimensions
    const dimensions: Record<string, { width: number; height: number }> = {
      facebook: { width: 1200, height: 628 },
      instagram: { width: 1080, height: 1080 },
      tiktok: { width: 1080, height: 1920 },
      all: { width: 1080, height: 1080 },
    };
    
    const { width, height } = dimensions[platform] || dimensions.instagram;
    canvasElement.width = width;
    canvasElement.height = height;
    
    const canvas = new FabricCanvas(canvasElement);
    canvas.setWidth(width);
    canvas.setHeight(height);
    
    // Load background image
    FabricImage.fromURL(backgroundImageUrl, { crossOrigin: "anonymous" })
      .then((img) => {
        // Scale image to fit canvas
        const scaleX = width / (img.width || 1);
        const scaleY = height / (img.height || 1);
        const scale = Math.max(scaleX, scaleY);
        
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: width / 2,
          top: height / 2,
          originX: "center",
          originY: "center",
          selectable: false,
        });
        
        canvas.add(img);
        canvas.sendObjectToBack(img);
        
        // Add text overlays
        const textColor = "#FFFFFF";
        const strokeColor = "#000000";
        const shadowConfig = new Shadow({
          color: "rgba(0, 0, 0, 0.7)",
          blur: 10,
          offsetX: 2,
          offsetY: 2,
        });
        
        // Product Name (top, large)
        if (config.productName) {
          const productNameText = new Text(config.productName.toUpperCase(), {
            left: width / 2,
            top: height * 0.08,
            fontSize: width * 0.08,
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold",
            fill: textColor,
            stroke: strokeColor,
            strokeWidth: 2,
            textAlign: "center",
            originX: "center",
            originY: "top",
            shadow: shadowConfig,
            selectable: false,
          });
          canvas.add(productNameText);
        }
        
        // Tagline (below product name)
        if (config.tagline) {
          const taglineText = new Text(config.tagline, {
            left: width / 2,
            top: height * 0.20,
            fontSize: width * 0.045,
            fontFamily: "Arial, sans-serif",
            fontWeight: "normal",
            fill: textColor,
            stroke: strokeColor,
            strokeWidth: 1,
            textAlign: "center",
            originX: "center",
            originY: "top",
            shadow: shadowConfig,
            selectable: false,
          });
          canvas.add(taglineText);
        }
        
        // Price section (bottom)
        let priceY = height * 0.82;
        
        if (config.promotionalPrice && config.price) {
          // Promotional price (crossed out)
          const promoText = new Text(config.promotionalPrice, {
            left: width / 2 - width * 0.15,
            top: priceY,
            fontSize: width * 0.05,
            fontFamily: "Arial, sans-serif",
            fill: "#FF6B6B",
            stroke: strokeColor,
            strokeWidth: 1,
            textAlign: "center",
            originX: "center",
            originY: "center",
            linethrough: true,
            shadow: shadowConfig,
            selectable: false,
          });
          canvas.add(promoText);
          
          // Current price (highlighted)
          const priceText = new Text(config.price, {
            left: width / 2 + width * 0.15,
            top: priceY,
            fontSize: width * 0.08,
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold",
            fill: "#FFD700",
            stroke: strokeColor,
            strokeWidth: 2,
            textAlign: "center",
            originX: "center",
            originY: "center",
            shadow: shadowConfig,
            selectable: false,
          });
          canvas.add(priceText);
        } else if (config.price) {
          // Just regular price
          const priceText = new Text(config.price, {
            left: width / 2,
            top: priceY,
            fontSize: width * 0.08,
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold",
            fill: "#FFD700",
            stroke: strokeColor,
            strokeWidth: 2,
            textAlign: "center",
            originX: "center",
            originY: "center",
            shadow: shadowConfig,
            selectable: false,
          });
          canvas.add(priceText);
        }
        
        // Call to action (bottom)
        if (config.callToAction) {
          const ctaText = new Text(config.callToAction.toUpperCase(), {
            left: width / 2,
            top: height * 0.92,
            fontSize: width * 0.05,
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold",
            fill: "#FFFFFF",
            stroke: strokeColor,
            strokeWidth: 1,
            textAlign: "center",
            originX: "center",
            originY: "center",
            shadow: shadowConfig,
            selectable: false,
          });
          canvas.add(ctaText);
        }
        
        // Render and export
        canvas.renderAll();
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 1,
        });
        
        // Cleanup
        canvas.dispose();
        
        resolve(dataUrl);
      })
      .catch((error) => {
        console.error("Error creating text overlay:", error);
        reject(error);
      });
  });
};

/**
 * Converts a data URL to a Blob for uploading
 */
export const dataURLtoBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};
