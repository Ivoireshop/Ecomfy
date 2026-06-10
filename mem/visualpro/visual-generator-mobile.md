---
name: Visual Generator Mobile UX
description: Mobile-first overhaul of /generator + text editor + Library + 30-day backend cleanup
type: feature
---
- `/generator` (src/pages/Generator.tsx): hero hidden on mobile (md:block); ExampleSlideshow desktop-only; mode tabs are sticky top, vertical icon+label on mobile.
- `ImageTextEditor` (src/components/ImageTextEditor.tsx): canvas auto-sized to wrapper width and image aspect; default text = ~8% image height, bold, white with shadow; touch handles 44px (`touchCornerSize`); dialog fullscreen + sticky bottom action bar with safe-area on mobile.
- `Library` (src/pages/Library.tsx): grid 2/3/4 cols, aspect-square thumbnails, 30-day retention banner.
- Backend: `public.cleanup_old_generated_media()` + pg_cron job `cleanup-old-generated-media` daily at 03:00 UTC deletes `generated_images` & `generated_videos` older than 30 days.
