import { useState } from "react";
import { ShowcaseCourses } from "./ShowcaseCourses";
import { ShowcaseCourseDetail } from "./ShowcaseCourseDetail";

interface ShowcaseCoursesPageProps {
  showcaseSiteId: string;
  primaryColor?: string;
  textColor?: string;
}

export function ShowcaseCoursesPage({ showcaseSiteId, primaryColor, textColor }: ShowcaseCoursesPageProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

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
      onCourseClick={setSelectedCourseId}
      primaryColor={primaryColor}
      textColor={textColor}
    />
  );
}
