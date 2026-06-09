import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Pin, Lock, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type Topic = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  is_pinned: boolean;
  is_closed: boolean;
  reply_count: number;
  like_count: number;
  last_activity_at: string;
  created_at: string;
};

type Reply = {
  id: string;
  topic_id: string;
  user_id: string;
  body: string;
  like_count: number;
  is_support: boolean;
  created_at: string;
};

type ProfileLite = { id: string; full_name: string | null; avatar_url: string | null };

const CATEGORIES: { value: string; label: string }[] = [
  { value: "general", label: "Général" },
  { value: "idea", label: "Idée" },
  { value: "feedback", label: "Avis" },
  { value: "support", label: "Support" },
];

const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const Avatar = ({ p }: { p?: ProfileLite | null }) => {
  const initials = (p?.full_name || "?").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return p?.avatar_url ? (
    <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-muted text-foreground text-xs font-semibold flex items-center justify-center">{initials}</div>
  );
};

const Community = () => {
  const { session, isReady } = useAuthReady();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [likedTopics, setLikedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCat, setNewCat] = useState("general");
  const [creating, setCreating] = useState(false);
  const [openTopic, setOpenTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [isFounder, setIsFounder] = useState(false);

  useEffect(() => {
    if (isReady && !session) navigate("/auth", { replace: true });
  }, [isReady, session, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    void (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        // @ts-ignore
        .in("role", ["founder", "co_founder"]);
      setIsFounder((data || []).length > 0);
    })();
  }, [session?.user]);

  const loadProfiles = async (ids: string[]) => {
    const need = ids.filter((id) => id && !profiles[id]);
    if (!need.length) return;
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", need);
    if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries(data.map((d: any) => [d.id, d])) }));
  };

  const loadTopics = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_topics")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(100);
    const list = (data as Topic[]) || [];
    setTopics(list);
    await loadProfiles(list.map((t) => t.user_id));
    if (session?.user) {
      const { data: likes } = await supabase
        .from("community_likes")
        .select("target_id")
        .eq("user_id", session.user.id)
        .eq("target_type", "topic");
      setLikedTopics(new Set((likes || []).map((l: any) => l.target_id)));
    }
    setLoading(false);
  };

  useEffect(() => { if (session?.user) void loadTopics(); }, [session?.user]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !session?.user) return;
    setCreating(true);
    const { error } = await supabase.from("community_topics").insert({
      user_id: session.user.id, title: newTitle.trim(), body: newBody.trim(), category: newCat,
    });
    setCreating(false);
    if (error) { toast.error("Impossible de publier"); return; }
    setOpenNew(false); setNewTitle(""); setNewBody(""); setNewCat("general");
    toast.success("Sujet publié");
    void loadTopics();
  };

  const toggleLike = async (topicId: string) => {
    if (!session?.user) return;
    const liked = likedTopics.has(topicId);
    setLikedTopics((s) => { const n = new Set(s); liked ? n.delete(topicId) : n.add(topicId); return n; });
    setTopics((ts) => ts.map((t) => t.id === topicId ? { ...t, like_count: Math.max(0, t.like_count + (liked ? -1 : 1)) } : t));
    if (liked) {
      await supabase.from("community_likes").delete().match({ user_id: session.user.id, target_type: "topic", target_id: topicId });
    } else {
      await supabase.from("community_likes").insert({ user_id: session.user.id, target_type: "topic", target_id: topicId });
    }
  };

  const openTopicView = async (topic: Topic) => {
    setOpenTopic(topic);
    setReplies([]);
    const { data } = await supabase
      .from("community_replies").select("*").eq("topic_id", topic.id).order("created_at", { ascending: true });
    const list = (data as Reply[]) || [];
    setReplies(list);
    await loadProfiles(list.map((r) => r.user_id).concat(topic.user_id));
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !openTopic || !session?.user) return;
    setPostingReply(true);
    const { error } = await supabase.from("community_replies").insert({
      topic_id: openTopic.id, user_id: session.user.id, body: replyBody.trim(), is_support: isFounder,
    });
    setPostingReply(false);
    if (error) { toast.error("Impossible d'envoyer"); return; }
    setReplyBody("");
    void openTopicView(openTopic);
    void loadTopics();
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Supprimer ce sujet ?")) return;
    await supabase.from("community_topics").delete().eq("id", id);
    setOpenTopic(null); void loadTopics();
  };

  const deleteReply = async (id: string) => {
    if (!confirm("Supprimer cette réponse ?")) return;
    await supabase.from("community_replies").delete().eq("id", id);
    if (openTopic) void openTopicView(openTopic);
    void loadTopics();
  };

  const togglePin = async (t: Topic) => {
    await supabase.from("community_topics").update({ is_pinned: !t.is_pinned }).eq("id", t.id);
    void loadTopics();
  };
  const toggleClose = async (t: Topic) => {
    await supabase.from("community_topics").update({ is_closed: !t.is_closed }).eq("id", t.id);
    void loadTopics();
    if (openTopic?.id === t.id) setOpenTopic({ ...t, is_closed: !t.is_closed });
  };

  const filtered = filter === "all" ? topics : topics.filter((t) => t.category === filter);

  return (
    <>
      <Helmet>
        <title>Communauté VisualPro — Échangez avec les entrepreneurs</title>
        <meta name="description" content="Forum communautaire VisualPro : posez vos questions, partagez vos idées, échangez avec d'autres entrepreneurs et le support." />
      </Helmet>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
              Communauté <span className="italic text-primary">VisualPro</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">
              Échangez avec d'autres entrepreneurs, partagez vos idées, recevez l'aide du support.
            </p>
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="rounded-full">Nouveau sujet</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Créer un sujet</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Titre" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={140} />
                <Select value={newCat} onValueChange={setNewCat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea placeholder="Décrivez votre sujet…" rows={6} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenNew(false)}>Annuler</Button>
                <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Publier
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <div className="flex gap-2 mb-6 flex-wrap">
          {[{ value: "all", label: "Tous" }, ...CATEGORIES].map((c) => (
            <button key={c.value}
              onClick={() => setFilter(c.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                filter === c.value ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}>{c.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            Aucun sujet pour l'instant. Soyez le premier à lancer la conversation.
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const p = profiles[t.user_id];
              return (
                <Card key={t.id} className="p-4 md:p-5 hover:border-foreground/30 transition-colors cursor-pointer" onClick={() => openTopicView(t)}>
                  <div className="flex items-start gap-3">
                    <Avatar p={p} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {t.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                        {t.is_closed && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        <h3 className="font-semibold truncate">{t.title}</h3>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{catLabel(t.category)}</Badge>
                      </div>
                      {t.body && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{t.body}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{p?.full_name || "Membre"}</span>
                        <span>· {formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true, locale: fr })}</span>
                        <button onClick={(e) => { e.stopPropagation(); toggleLike(t.id); }} className="flex items-center gap-1 hover:text-foreground transition-colors">
                          <Heart className={`w-3.5 h-3.5 ${likedTopics.has(t.id) ? "fill-primary text-primary" : ""}`} /> {t.like_count}
                        </button>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {t.reply_count}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!openTopic} onOpenChange={(o) => !o && setOpenTopic(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {openTopic && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    {openTopic.is_pinned && <Pin className="w-4 h-4 text-primary" />}
                    {openTopic.is_closed && <Lock className="w-4 h-4 text-muted-foreground" />}
                    {openTopic.title}
                    <Badge variant="outline" className="text-[10px]">{catLabel(openTopic.category)}</Badge>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-3 text-sm border-b pb-3">
                <Avatar p={profiles[openTopic.user_id]} />
                <div className="flex-1">
                  <div className="font-medium">{profiles[openTopic.user_id]?.full_name || "Membre"}</div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(openTopic.created_at), { addSuffix: true, locale: fr })}</div>
                </div>
                {isFounder && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => togglePin(openTopic)}><Pin className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleClose(openTopic)}><Lock className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteTopic(openTopic.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                )}
                {!isFounder && session?.user?.id === openTopic.user_id && (
                  <Button size="sm" variant="ghost" onClick={() => deleteTopic(openTopic.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                )}
              </div>

              {openTopic.body && <p className="text-sm whitespace-pre-wrap py-2">{openTopic.body}</p>}

              <div className="space-y-3 mt-2">
                {replies.map((r) => {
                  const p = profiles[r.user_id];
                  return (
                    <div key={r.id} className={`p-3 rounded-lg border ${r.is_support ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center gap-2 mb-1.5 text-sm">
                        <Avatar p={p} />
                        <div className="flex-1">
                          <span className="font-medium">{p?.full_name || "Membre"}</span>
                          {r.is_support && <Badge className="ml-2 text-[10px] gap-1"><ShieldCheck className="w-3 h-3" />Support</Badge>}
                          <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: fr })}</div>
                        </div>
                        {(isFounder || session?.user?.id === r.user_id) && (
                          <Button size="sm" variant="ghost" onClick={() => deleteReply(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap pl-10">{r.body}</p>
                    </div>
                  );
                })}
              </div>

              {!openTopic.is_closed ? (
                <div className="mt-4 border-t pt-4">
                  <Textarea placeholder="Votre réponse…" rows={3} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                  <div className="flex justify-end mt-2">
                    <Button onClick={handleReply} disabled={postingReply || !replyBody.trim()}>
                      {postingReply && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Répondre
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground mt-4 border-t pt-4">Ce sujet est fermé.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Community;