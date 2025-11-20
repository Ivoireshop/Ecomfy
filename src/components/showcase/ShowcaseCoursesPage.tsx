import { useState } from "react";
import { ShowcaseCourses } from "./ShowcaseCourses";
import { ShowcaseCourseDetail } from "./ShowcaseCourseDetail";

interface ShowcaseCoursesPageProps {
  showcaseSiteId: string;
  primaryColor?: string;
  textColor?: string;
  legacyFormations?: any[];
}

export function ShowcaseCoursesPage({ showcaseSiteId, primaryColor, textColor, legacyFormations }: ShowcaseCoursesPageProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Ne pas permettre de voir les détails des formations legacy
  const handleCourseClick = (courseId: string) => {
    if (!courseId.startsWith('legacy-')) {
      setSelectedCourseId(courseId);
    }
  };

  if (selectedCourseId) {
    return (
      <ShowcaseCourseDetail
        courseId={selectedCourseId}
        showcaseSiteId={showcaseSiteId}
        onBack={() => setSelectedCourseId(null)}
        primaryColor={primaryColor}
        textColor={textColor}
      />
    );
  }

  return (
    <ShowcaseCourses
      showcaseSiteId={showcaseSiteId}
      onCourseClick={handleCourseClick}
      primaryColor={primaryColor}
      textColor={textColor}
      legacyFormations={legacyFormations}
    />
  );
}
