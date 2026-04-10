import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Plus, BookOpen, Users, Send, Edit, Trash2, Eye, EyeOff,
  GraduationCap, BarChart3, Settings
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CourseModulesManager } from "@/components/CourseModulesManager";
import { EnrollmentsManager } from "@/components/EnrollmentsManager";

interface Course {
  id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  price: number;
  currency: string;
  category: string;
  duration: string | null;
  level: string | null;
  image_url: string | null;
  is_published: boolean;
  whatsapp_group_link: string | null;
  created_at: string;
  showcase_site_id: string | null;
}

export default function CoursesManager() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState("courses");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newShortDesc, setNewShortDesc] = useState("");
  const [newPrice, setNewPrice] = useState("0");
  const [newCurrency, setNewCurrency] = useState("XOF");
  const [newCategory, setNewCategory] = useState("formation");
  const [newDuration, setNewDuration] = useState("");
  const [newLevel, setNewLevel] = useState("débutant");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
    loadCourses(user.id);
  };

  const loadCourses = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des formations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newTitle.trim() || !userId) return;
    setCreating(true);

    try {
      const { data, error } = await supabase
        .from("courses")
        .insert({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          short_description: newShortDesc.trim() || null,
          price: parseFloat(newPrice) || 0,
          currency: newCurrency,
          category: newCategory,
          duration: newDuration.trim() || null,
          level: newLevel || null,
          whatsapp_group_link: newWhatsapp.trim() || null,
          user_id: userId,
          is_published: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Formation créée avec succès !");
      setShowCreateDialog(false);
      resetForm();
      loadCourses(userId);
    } catch (error: any) {
      toast.error("Erreur lors de la création");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewShortDesc("");
    setNewPrice("0");
    setNewCurrency("XOF");
    setNewCategory("formation");
    setNewDuration("");
    setNewLevel("débutant");
    setNewWhatsapp("");
  };

  const togglePublish = async (course: Course) => {
    try {
      const { error } = await supabase
        .from("courses")
        .update({ is_published: !course.is_published })
        .eq("id", course.id);

      if (error) throw error;
      toast.success(course.is_published ? "Formation dépubliée" : "Formation publiée !");
      if (userId) loadCourses(userId);
    } catch (error: any) {
      toast.error("Erreur");
      console.error(error);
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette formation ?")) return;

    try {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);

      if (error) throw error;
      toast.success("Formation supprimée");
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
        setActiveTab("courses");
      }
      if (userId) loadCourses(userId);
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-primary" />
              Mes Formations
            </h1>
            <p className="text-muted-foreground mt-1">
              Créez, gérez et envoyez vos formations en ligne
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Formation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer une formation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Titre *</Label>
                  <Input
                    placeholder="Ex: Marketing Digital Avancé"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description courte</Label>
                  <Input
                    placeholder="Résumé en une phrase"
                    value={newShortDesc}
                    onChange={(e) => setNewShortDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description complète</Label>
                  <Textarea
                    placeholder="Décrivez votre formation en détail..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prix</Label>
                    <Input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Devise</Label>
                    <Select value={newCurrency} onValueChange={setNewCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Durée</Label>
                    <Input
                      placeholder="Ex: 4 semaines"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Niveau</Label>
                    <Select value={newLevel} onValueChange={setNewLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="débutant">Débutant</SelectItem>
                        <SelectItem value="intermédiaire">Intermédiaire</SelectItem>
                        <SelectItem value="avancé">Avancé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Lien groupe WhatsApp (optionnel)</Label>
                  <Input
                    placeholder="https://chat.whatsapp.com/..."
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateCourse}
                  disabled={creating || !newTitle.trim()}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer la formation
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{courses.length}</div>
                <div className="text-sm text-muted-foreground">Formations</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Eye className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold">
                  {courses.filter(c => c.is_published).length}
                </div>
                <div className="text-sm text-muted-foreground">Publiées</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <EyeOff className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">
                  {courses.filter(c => !c.is_published).length}
                </div>
                <div className="text-sm text-muted-foreground">Brouillons</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedCourse ? (
          /* Course Detail View */
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => { setSelectedCourse(null); setActiveTab("courses"); }}>
                ← Retour
              </Button>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{selectedCourse.title}</h2>
                <Badge variant={selectedCourse.is_published ? "default" : "secondary"}>
                  {selectedCourse.is_published ? "Publiée" : "Brouillon"}
                </Badge>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="modules">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Modules
                </TabsTrigger>
                <TabsTrigger value="students">
                  <Users className="h-4 w-4 mr-2" />
                  Étudiants
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Paramètres
                </TabsTrigger>
              </TabsList>

              <TabsContent value="modules" className="mt-6">
                <CourseModulesManager courseId={selectedCourse.id} />
              </TabsContent>

              <TabsContent value="students" className="mt-6">
                <StudentsSendSection courseId={selectedCourse.id} courseTitle={selectedCourse.title} />
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <CourseSettings
                  course={selectedCourse}
                  onUpdate={() => {
                    if (userId) loadCourses(userId);
                    // Refresh selected course
                    supabase
                      .from("courses")
                      .select("*")
                      .eq("id", selectedCourse.id)
                      .single()
                      .then(({ data }) => {
                        if (data) setSelectedCourse(data);
                      });
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          /* Course List */
          <div className="space-y-4">
            {courses.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">Aucune formation</h3>
                  <p className="text-muted-foreground mb-6">
                    Créez votre première formation et commencez à enseigner
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer ma première formation
                  </Button>
                </CardContent>
              </Card>
            ) : (
              courses.map((course) => (
                <Card
                  key={course.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => { setSelectedCourse(course); setActiveTab("modules"); }}
                >
                  <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {course.image_url ? (
                        <img
                          src={course.image_url}
                          alt={course.title}
                          className="w-20 h-14 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{course.title}</h3>
                        {course.short_description && (
                          <p className="text-sm text-muted-foreground truncate">{course.short_description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm font-medium">
                            {course.price > 0 ? `${course.price.toLocaleString()} ${course.currency}` : "Gratuite"}
                          </span>
                          {course.level && (
                            <span className="text-xs text-muted-foreground capitalize">{course.level}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(course.created_at), "dd MMM yyyy", { locale: fr })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Badge variant={course.is_published ? "default" : "secondary"}>
                        {course.is_published ? "Publiée" : "Brouillon"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePublish(course)}
                        title={course.is_published ? "Dépublier" : "Publier"}
                      >
                        {course.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCourse(course.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function StudentsSendSection({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  type StudentEnrollment = {
    id: string;
    student_name: string;
    student_email: string;
    payment_status: string;
    created_at: string;
  };

  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    setLoadingEnrollments(true);
    loadEnrollments();
  }, [courseId]);

  const loadEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, student_name, student_email, payment_status, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEnrollments((data || []) as StudentEnrollment[]);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de charger les étudiants");
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const getStatusBadge = (paymentStatus: string) => {
    if (paymentStatus === "paid") {
      return <Badge>Accès actif</Badge>;
    }

    if (paymentStatus === "revoked") {
      return <Badge variant="destructive">Accès coupé</Badge>;
    }

    return <Badge variant="secondary">En attente</Badge>;
  };

  const handleSend = async () => {
    const trimmedName = studentName.trim();
    const trimmedEmail = studentEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      toast.error("Veuillez remplir le nom et l'email");
      return;
    }

    const existingEnrollment = enrollments.find(
      (enrollment) => enrollment.student_email.trim().toLowerCase() === trimmedEmail
    );

    if (existingEnrollment) {
      toast.error("Cet étudiant est déjà inscrit. Utilisez les actions à droite pour gérer son accès.");
      return;
    }

    setSending(true);
    try {
      const { data: enrollment, error: insertError } = await supabase
        .from("enrollments")
        .insert({
          course_id: courseId,
          student_name: trimmedName,
          student_email: trimmedEmail,
          payment_status: "paid",
          validated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const response = await supabase.functions.invoke("create-student-account", {
        body: {
          enrollmentId: enrollment.id,
          courseId,
          studentEmail: trimmedEmail,
          studentName: trimmedName,
        },
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data as { success?: boolean; message?: string } | null;

      if (result?.success) {
        toast.success(result.message || "Formation envoyée avec succès.");
      } else {
        toast.error(result?.message || "Compte créé, mais l'email n'a pas pu être envoyé.");
      }

      setStudentName("");
      setStudentEmail("");
      loadEnrollments();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de l'envoi");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const runStudentAction = async (
    enrollmentId: string,
    action: "revoke" | "restore" | "delete",
  ) => {
    setActionKey(`${action}-${enrollmentId}`);

    try {
      const response = await supabase.functions.invoke("manage-student-access", {
        body: {
          enrollmentId,
          action,
        },
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data as { success?: boolean; message?: string } | null;

      if (!result?.success) {
        toast.error(result?.message || "Action impossible");
        return;
      }

      toast.success(result.message || "Action effectuée");
      loadEnrollments();
    } catch (error: any) {
      toast.error(error?.message || "Action impossible");
      console.error(error);
    } finally {
      setActionKey(null);
    }
  };

  const handleResend = async (enrollment: StudentEnrollment) => {
    setActionKey(`resend-${enrollment.id}`);

    try {
      const response = await supabase.functions.invoke("create-student-account", {
        body: {
          enrollmentId: enrollment.id,
          courseId,
          studentEmail: enrollment.student_email,
          studentName: enrollment.student_name,
          resend: true,
        },
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data as { success?: boolean; message?: string } | null;

      if (result?.success) {
        toast.success(result.message || "Accès renvoyés avec succès.");
      } else {
        toast.error(result?.message || "Le renvoi a échoué.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Le renvoi a échoué.");
      console.error(error);
    } finally {
      setActionKey(null);
    }
  };

  const handleDelete = async (enrollmentId: string) => {
    const confirmed = window.confirm("Voulez-vous vraiment supprimer cet étudiant de cette formation ?");

    if (!confirmed) {
      return;
    }

    await runStudentAction(enrollmentId, "delete");
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Envoyer cette formation
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ajoutez un étudiant à <strong>{courseTitle}</strong>, puis gérez ensuite son accès directement depuis la liste.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom de l'étudiant</Label>
              <Input
                placeholder="Ex: Jean Dupont"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email de l'étudiant</Label>
              <Input
                type="email"
                placeholder="ex: jean@email.com"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleSend}
            disabled={sending || !studentName.trim() || !studentEmail.trim()}
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi en cours...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Envoyer la formation</>
            )}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-2">
          Étudiants inscrits ({enrollments.length})
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Vous pouvez renvoyer les accès, couper l'accès, le réactiver ou supprimer l'étudiant de cette formation.
        </p>
        {loadingEnrollments ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun étudiant inscrit à cette formation
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => (
              <Card key={enrollment.id}>
                <CardContent className="py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{enrollment.student_name}</div>
                    <div className="text-sm text-muted-foreground break-all">{enrollment.student_email}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Ajouté le {format(new Date(enrollment.created_at), "dd MMM yyyy", { locale: fr })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end">
                    {getStatusBadge(enrollment.payment_status)}
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResend(enrollment)}
                        disabled={actionKey !== null}
                      >
                        {actionKey === `resend-${enrollment.id}` ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Renvoyer
                      </Button>

                      {enrollment.payment_status === "paid" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runStudentAction(enrollment.id, "revoke")}
                          disabled={actionKey !== null}
                        >
                          {actionKey === `revoke-${enrollment.id}` ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <EyeOff className="h-4 w-4 mr-2" />
                          )}
                          Couper l'accès
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runStudentAction(enrollment.id, "restore")}
                          disabled={actionKey !== null}
                        >
                          {actionKey === `restore-${enrollment.id}` ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4 mr-2" />
                          )}
                          Réactiver l'accès
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(enrollment.id)}
                        disabled={actionKey !== null}
                      >
                        {actionKey === `delete-${enrollment.id}` ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseSettings({ course, onUpdate }: { course: Course; onUpdate: () => void }) {
function CourseSettings({ course, onUpdate }: { course: Course; onUpdate: () => void }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description || "");
  const [shortDesc, setShortDesc] = useState(course.short_description || "");
  const [price, setPrice] = useState(String(course.price));
  const [currency, setCurrency] = useState(course.currency);
  const [duration, setDuration] = useState(course.duration || "");
  const [level, setLevel] = useState(course.level || "débutant");
  const [whatsapp, setWhatsapp] = useState(course.whatsapp_group_link || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("courses")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          short_description: shortDesc.trim() || null,
          price: parseFloat(price) || 0,
          currency,
          duration: duration.trim() || null,
          level: level || null,
          whatsapp_group_link: whatsapp.trim() || null,
        })
        .eq("id", course.id);

      if (error) throw error;
      toast.success("Formation mise à jour !");
      onUpdate();
    } catch (error: any) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres de la formation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Titre</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description courte</Label>
          <Input value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description complète</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Prix</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Devise</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Durée</Label>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ex: 4 semaines" />
          </div>
          <div className="space-y-2">
            <Label>Niveau</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="débutant">Débutant</SelectItem>
                <SelectItem value="intermédiaire">Intermédiaire</SelectItem>
                <SelectItem value="avancé">Avancé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Lien groupe WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="https://chat.whatsapp.com/..." />
        </div>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
