import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Target, Award, MessageCircle, Heart } from "lucide-react";

interface ShowcaseAboutProps {
  site: any;
  testimonials: any[];
  onContactClick: () => void;
}

export const ShowcaseAbout = ({ site, testimonials, onContactClick }: ShowcaseAboutProps) => {
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : (site.text_color || '#000000');
  
  return (
    <div className="min-h-screen py-20 px-4 animate-fade-in">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4" variant="outline">
            <User className="h-4 w-4 mr-2" />
            À Propos
          </Badge>
          <h1 
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: textColor }}
          >
            {site.about_title || "À Propos de Nous"}
          </h1>
        </div>

        {/* Main About Section */}
        <div className={`mb-20 ${site.about_layout === 'side-by-side' ? 'grid md:grid-cols-2 gap-12 items-center' : 'space-y-8'}`}>
          {(site.about_video_url || site.about_image_url) && (
            <div className={`scroll-fade-in ${site.about_layout === 'stacked' ? 'max-w-4xl mx-auto' : ''}`}>
              {site.about_video_url ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl hover-scale">
                  <video
                    src={site.about_video_url}
                    controls
                    className="w-full h-auto"
                    poster={site.about_image_url}
                  />
                </div>
              ) : site.about_image_url ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl hover-scale">
                  <img 
                    src={site.about_image_url}
                    alt="À propos"
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : null}
            </div>
          )}

          <div className={`scroll-fade-in ${site.about_layout === 'stacked' ? 'max-w-4xl mx-auto text-center' : ''}`}>
            {site.about_description && (
              <div 
                className="prose max-w-none mb-8 text-lg leading-relaxed"
                style={{ color: textColor }}
              >
                {site.about_description.split('\n').map((paragraph: string, index: number) => (
                  <p key={index} className="mb-4">{paragraph}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <Card className="flex-1 p-6 hover-scale">
                <Target className="h-10 w-10 mb-4" style={{ color: site.primary_color || '#D4AF37' }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Notre Mission</h3>
                <p className="text-sm opacity-80" style={{ color: textColor }}>Offrir des services de qualité exceptionnelle</p>
              </Card>
              
              <Card className="flex-1 p-6 hover-scale">
                <Award className="h-10 w-10 mb-4" style={{ color: site.secondary_color || '#10B981' }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Notre Excellence</h3>
                <p className="text-sm opacity-80" style={{ color: textColor }}>Des résultats qui dépassent les attentes</p>
              </Card>
            </div>
          </div>
        </div>

        {/* Owner Section */}
        {site.owner_name && (
          <div 
            className="mb-20 p-12 rounded-2xl scroll-fade-in"
            style={{ 
              background: `linear-gradient(135deg, ${site.primary_color}10, ${site.secondary_color}10)`
            }}
          >
            <div className="max-w-4xl mx-auto text-center">
              {site.owner_photo_url && (
                <img 
                  src={site.owner_photo_url}
                  alt={site.owner_name}
                  className="w-32 h-32 rounded-full mx-auto mb-6 object-cover border-4 hover-scale"
                  style={{ borderColor: site.primary_color || '#D4AF37' }}
                />
              )}
               <h3 
                className="text-3xl font-bold mb-4"
                style={{ color: textColor }}
              >
                {site.owner_name}
              </h3>
              <p 
                className="text-xl mb-2"
                style={{ color: site.primary_color || '#D4AF37' }}
              >
                Fondateur & Expert
              </p>
            </div>
          </div>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <div className="mb-20">
            <h2 
              className="text-3xl font-bold text-center mb-12 scroll-fade-in"
              style={{ color: textColor }}
            >
              <Heart className="inline-block mr-3 mb-1" style={{ color: site.secondary_color || '#10B981' }} />
              Ce que disent nos clients
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card 
                  key={testimonial.id}
                  className="p-6 scroll-fade-in hover-scale"
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'backwards'
                  }}
                >
                  {testimonial.result_image_url && (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img 
                        src={testimonial.result_image_url}
                        alt="Résultat"
                        className="w-full h-48 object-cover transition-transform duration-500 hover:scale-105"
                      />
                    </div>
                  )}
                  
                  <p 
                    className="mb-4 italic leading-relaxed"
                    style={{ color: textColor }}
                  >
                    "{testimonial.testimonial_text}"
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: site.primary_color || '#D4AF37' }}
                    >
                      {testimonial.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.full_name}</p>
                      <p className="text-sm opacity-70">Client satisfait</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center scroll-fade-in">
          <h3 
            className="text-3xl font-bold mb-6"
            style={{ color: textColor }}
          >
            Prêt à commencer votre transformation ?
          </h3>
          <Button
            size="lg"
            onClick={onContactClick}
            className="hover-scale"
            style={{ 
              backgroundColor: site.primary_color || '#D4AF37',
              color: '#ffffff'
            }}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Contactez-nous
          </Button>
        </div>
      </div>
    </div>
  );
};
