import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Calendar, Building } from "lucide-react";

interface Experience {
  title: string;
  company: string;
  period: string;
  description: string;
}

interface ShowcaseBiographyProps {
  site: any;
}

export const ShowcaseBiography = ({ site }: ShowcaseBiographyProps) => {
  const experiences: Experience[] = site.professional_experience || [];
  const textColor = site.theme_mode === 'dark' ? '#ffffff' : (site.text_color || '#000000');
  
  console.log('ShowcaseBiography - site data:', site);
  console.log('ShowcaseBiography - biography_content:', site.biography_content);
  console.log('ShowcaseBiography - biography_image_url:', site.biography_image_url);
  console.log('ShowcaseBiography - professional_experience:', experiences);

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <Badge className="mb-4" variant="outline">
            <Briefcase className="h-4 w-4 mr-2" />
            {site.biography_title || "Biographie"}
          </Badge>
          <h1 
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: textColor }}
          >
            {site.owner_name}
          </h1>
        </div>

        {/* Biography Content with Image Side by Side */}
        {site.biography_content && (
          <div className="mb-16">
            <div className={`grid ${site.biography_image_url ? 'md:grid-cols-2' : 'grid-cols-1'} gap-8 items-start`}>
              {/* Order based on position */}
              {site.biography_image_url && (site as any).biography_image_position === 'left' && (
                <div>
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl sticky top-8">
                    <img 
                      src={site.biography_image_url}
                      alt={site.owner_name}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}
              
              {/* Biography Text */}
              <div 
                className="prose max-w-none text-lg leading-relaxed"
                style={{ color: textColor }}
              >
                {site.biography_content.split('\n').map((paragraph: string, index: number) => (
                  <p key={index} className="mb-4">{paragraph}</p>
                ))}
              </div>

              {/* Image on right */}
              {site.biography_image_url && (site as any).biography_image_position === 'right' && (
                <div>
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl sticky top-8">
                    <img 
                      src={site.biography_image_url}
                      alt={site.owner_name}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Professional Experience */}
        {experiences.length > 0 && (
          <div>
            <h2 
              className="text-3xl font-bold mb-8 text-center"
              style={{ color: textColor }}
            >
              Expérience Professionnelle
            </h2>
            <div className="space-y-6">
              {experiences.map((exp, index) => (
                <Card 
                  key={index} 
                  className="p-6 transition-all duration-300"
                  style={{
                    borderLeft: `4px solid ${site.primary_color || '#D4AF37'}`,
                    background: site.theme_mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(255, 255, 255, 0.8)'
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                    <div className="flex-1">
                      <h3 
                        className="text-xl font-bold mb-2"
                        style={{ color: site.primary_color || '#D4AF37' }}
                      >
                        {exp.title}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm mb-2" style={{ color: textColor, opacity: 0.8 }}>
                        {exp.company && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            <span>{exp.company}</span>
                          </div>
                        )}
                        {exp.period && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{exp.period}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {exp.description && (
                    <p 
                      className="leading-relaxed"
                      style={{ color: textColor, opacity: 0.9 }}
                    >
                      {exp.description}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
