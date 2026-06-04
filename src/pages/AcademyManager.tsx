import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, GraduationCap, ExternalLink } from "lucide-react";

type Course = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  video_url: string;
  thumbnail_url: string | null;
  duration: string | null;
  level: string | null;
  order_index: number;
  is_published: boolean;
};

const CATEGORIES = [
  { value: "account", label: "Créer son compte" },
  { value: "visuals", label: "Visuels publicitaires" },
  { value: "videos", label: "Vidéos animées" },
  { value: "showcase", label: "Sites vitrine" },
  { value: "shop", label: "Boutiques e-commerce" },
  { value: "courses", label: "Formations" },
  { value: "api", label: "API & intégrations" },
  { value: "general", label: "Général" },
];

const empty = (): Course => ({
  id: "",
  title: "",
  description: "",
  category: "general",
  video_url: "",
  thumbnail_url: "",
  duration: "",
  level: "",
  order_index: 0,
  is_published: true,
});

const AcademyManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        // @ts-ignore
        .in("role", ["founder", "co_founder"]);
      const ok = !!roles && roles.length > 0;
      setIsAuthorized(ok);
      if (!ok) {
        toast({ title: "Accès refusé", description: "Réservé aux fondateurs.", variant: "destructive" });
        navigate("/academy");
        return;
      }
      await load();
    })();
  }, [navigate, toast]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("academy_courses" as any)
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setCourses((data as any) ?? []);
    }
    setLoading(false);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.video_url.trim()) {
      toast({ title: "Champs requis", description: "Titre et URL vidéo obligatoires.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      title: editing.title.trim(),
      description: editing.description || null,
      category: editing.category,
      video_url: editing.video_url.trim(),
      thumbnail_url: editing.thumbnail_url || null,
      duration: editing.duration || null,
      level: editing.level || null,
      order_index: editing.order_index ?? 0,
      is_published: editing.is_published,
    };
    const { error } = editing.id
      ? await supabase.from("academy_courses" as any).update(payload).eq("id", editing.id)
      : await supabase.from("academy_courses" as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Formation mise à jour" : "Formation ajoutée" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement cette formation ?")) return;
    const { error } = await supabase.from("academy_courses" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Formation supprimée" });
    load();
  };

  const togglePublish = async (course: Course) => {
    const { error } = await supabase
      .from("academy_courses" as any)
      .update({ is_published: !course.is_published })
      .eq("id", course.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b sticky top-0 bg-background/90 backdrop-blur z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/academy")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 truncate">
              <GraduationCap className="h-5 w-5 text-primary" />
              Gestion Academy
            </h1>
          </div>
          <Button onClick={() => setEditing(empty())}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-muted-foreground">Aucune formation. Ajoutez la première vidéo.</p>
              <Button onClick={() => setEditing(empty())}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </CardContent>
          </Card>
        ) : (
          courses.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="hidden sm:flex w-12 h-12 rounded-lg bg-primary/10 items-center justify-center text-primary font-bold shrink-0">
                  {c.order_index || "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold truncate">{c.title}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {CATEGORIES.find((x) => x.value === c.category)?.label ?? c.category}
                    </Badge>
                    {!c.is_published && <Badge variant="outline" className="text-xs">Brouillon</Badge>}
                    {c.duration && <Badge variant="outline" className="text-xs">{c.duration}</Badge>}
                  </div>
                  {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                  <a
                    href={c.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1 mt-1 hover:underline"
                  >
                    {c.video_url} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                  <Switch checked={c.is_published} onCheckedChange={() => togglePublish(c)} />
                  <Button size="icon" variant="outline" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier la formation" : "Nouvelle formation"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Titre *</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Comment créer son premier visuel"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Ce que l'apprenant va découvrir dans cette vidéo..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL de la vidéo * (YouTube, Vimeo, MP4...)</Label>
                <Input
                  value={editing.video_url}
                  onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Miniature (URL, optionnel)</Label>
                <Input
                  value={editing.thumbnail_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value })}
                  placeholder="https://... (auto pour YouTube)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Niveau</Label>
                  <Input
                    value={editing.level ?? ""}
                    onChange={(e) => setEditing({ ...editing, level: e.target.value })}
                    placeholder="Débutant, Intermédiaire..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Durée</Label>
                  <Input
                    value={editing.duration ?? ""}
                    onChange={(e) => setEditing({ ...editing, duration: e.target.value })}
                    placeholder="3:24"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordre d'affichage</Label>
                  <Input
                    type="number"
                    value={editing.order_index}
                    onChange={(e) => setEditing({ ...editing, order_index: parseInt(e.target.value || "0", 10) })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Publié</Label>
                  <p className="text-xs text-muted-foreground">Visible par tous les visiteurs.</p>
                </div>
                <Switch
                  checked={editing.is_published}
                  onCheckedChange={(v) => setEditing({ ...editing, is_published: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Annuler</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyManager;