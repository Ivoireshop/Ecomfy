import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Video, Play, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";

interface ShowcaseGalleryProps {
  galleries: Record<string, any[]>;
  galleryVideos: any[];
  site: any;
}

export const ShowcaseGallery = ({ galleries, galleryVideos, site }: ShowcaseGalleryProps) => {
  const [selectedMedia, setSelectedMedia] = useState<{ type: 'image' | 'video'; url: string; caption?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');

  const allImages = Object.values(galleries).flat();
  const hasImages = allImages.length > 0;
  const hasVideos = galleryVideos.length > 0;

  if (!hasImages && !hasVideos) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 px-4">
        <div className="text-center">
          <ImageIcon className="h-20 w-20 mx-auto mb-6 opacity-30" />
          <h2 className="text-2xl font-semibold mb-4">Aucun média disponible</h2>
          <p className="text-muted-foreground">La galerie sera bientôt remplie de contenus</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-20 px-4 animate-fade-in">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <Badge className="mb-4" variant="outline">
            <ImageIcon className="h-4 w-4 mr-2" />
            Galerie
          </Badge>
          <h1 
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: site.text_color || '#000000' }}
          >
            Notre Galerie
          </h1>
          <p 
            className="text-xl max-w-3xl mx-auto opacity-90"
            style={{ color: site.text_color || '#000000' }}
          >
            Découvrez nos réalisations en images et vidéos
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-12">
          {hasImages && (
            <Button
              onClick={() => setActiveTab('images')}
              variant={activeTab === 'images' ? 'default' : 'outline'}
              className="hover-scale"
              style={activeTab === 'images' ? { 
                backgroundColor: site.primary_color || '#D4AF37',
                color: '#ffffff'
              } : {}}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Images ({allImages.length})
            </Button>
          )}
          {hasVideos && (
            <Button
              onClick={() => setActiveTab('videos')}
              variant={activeTab === 'videos' ? 'default' : 'outline'}
              className="hover-scale"
              style={activeTab === 'videos' ? { 
                backgroundColor: site.primary_color || '#D4AF37',
                color: '#ffffff'
              } : {}}
            >
              <Video className="mr-2 h-4 w-4" />
              Vidéos ({galleryVideos.length})
            </Button>
          )}
        </div>

        {/* Images Grid */}
        {activeTab === 'images' && hasImages && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allImages.map((image, index) => (
              <div
                key={image.id}
                className="scroll-fade-in hover-scale cursor-pointer group relative overflow-hidden rounded-lg"
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'backwards'
                }}
                onClick={() => setSelectedMedia({ type: 'image', url: image.image_url, caption: image.image_caption })}
              >
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={image.image_url}
                    alt={image.image_caption || "Gallery image"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-white" />
                  </div>
                  {image.section_title && (
                    <Badge 
                      className="absolute top-2 left-2"
                      style={{ 
                        backgroundColor: site.primary_color || '#D4AF37',
                        color: '#ffffff'
                      }}
                    >
                      {image.section_title}
                    </Badge>
                  )}
                </div>
                {image.image_caption && (
                  <p className="mt-2 text-sm text-center px-2 line-clamp-2">
                    {image.image_caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Videos Grid */}
        {activeTab === 'videos' && hasVideos && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {galleryVideos.map((video, index) => (
              <Card
                key={video.id}
                className="scroll-fade-in hover-scale overflow-hidden group cursor-pointer"
                style={{ 
                  animationDelay: `${index * 0.1}s`,
                  animationFillMode: 'backwards'
                }}
                onClick={() => setSelectedMedia({ type: 'video', url: video.video_url, caption: video.video_caption })}
              >
                <div className="relative aspect-video overflow-hidden bg-black">
                  <video
                    src={video.video_url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: site.primary_color || '#D4AF37' }}
                    >
                      <Play className="h-8 w-8 text-white ml-1" />
                    </div>
                  </div>
                  {video.section_title && (
                    <Badge 
                      className="absolute top-4 left-4"
                      style={{ 
                        backgroundColor: site.primary_color || '#D4AF37',
                        color: '#ffffff'
                      }}
                    >
                      {video.section_title}
                    </Badge>
                  )}
                </div>
                {video.video_caption && (
                  <div className="p-4">
                    <p className="text-sm">{video.video_caption}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Media Viewer Dialog */}
        <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
          <DialogContent className="max-w-4xl p-0">
            <DialogHeader className="p-4 pb-0">
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-4 top-4 z-50"
                onClick={() => setSelectedMedia(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
            {selectedMedia?.type === 'image' ? (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.caption || "Gallery image"}
                className="w-full h-auto"
              />
            ) : selectedMedia?.type === 'video' ? (
              <video
                src={selectedMedia.url}
                controls
                autoPlay
                className="w-full h-auto"
              />
            ) : null}
            {selectedMedia?.caption && (
              <div className="p-4">
                <p className="text-center">{selectedMedia.caption}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
