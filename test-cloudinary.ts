const cloudName = "dk6m85m3n";
const publicId = "test_image";
const dur = 5;
const animatedVideoUrl = `https://res.cloudinary.com/${cloudName}/video/upload/` +
  `e_zoompan:du_${dur};zoom_1.5;x_0.5;y_0.5,` +
  `ac_none,` +
  `fps_25,` +
  `vc_mp4/` +
  `${publicId.replace(/\//g, ":")}.mp4`;
console.log(animatedVideoUrl);
