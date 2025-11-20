import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CourseModulesManager } from "./CourseModulesManager";
import { Loader2 } from "lucide-react";

interface ModulesTabContentProps {
  showcaseSiteId: string;
}

export function ModulesTabContent({ showcaseSiteId }: ModulesTabContentProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, [showcaseSiteId]);

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .eq("showcase_site_id", showcaseSiteId)
        .order("title");

      if (error) throw error;
      setCourses(data || []);

      // Auto-select first course if available
      if (data && data.length > 0) {
        setSelectedCourseId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading courses:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Créez d'abord une formation dans l'onglet "Formations" avant de gérer les modules
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une formation</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une formation" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCourseId && <CourseModulesManager courseId={selectedCourseId} />}
    </div>
  );
}
