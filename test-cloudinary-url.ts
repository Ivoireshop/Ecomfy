import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

async function run() {
  const cloudName = "dxqge1dvt";
  // using an example public ID
  const publicId = "test_image_123";
  
  const animatedVideoUrl = `https://res.cloudinary.com/${cloudName}/video/upload/e_zoompan:du_5;zoom_1.5;x_0.5;y_0.5,ac_none,fps_25,vc_mp4/${publicId}.mp4`;
  console.log("Checking:", animatedVideoUrl);
  
  const resp = await fetch(animatedVideoUrl);
  console.log("Status:", resp.status);
  console.log("Content-Type:", resp.headers.get("content-type"));
}

run();
