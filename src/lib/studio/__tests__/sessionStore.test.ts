import { describe, expect, it } from "vitest";
import {
  clearStudioSession,
  loadStudioMedia,
  loadStudioSession,
  MAX_MEDIA_BYTES,
  saveStudioMedia,
  saveStudioSession,
  SESSION_TTL_MS,
} from "../sessionStore";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    removeItem: (k: string) => { delete data[k]; },
  };
}

const settings = { aspectRatio: "9:16", style: "luxury", videoDuration: "5" };
const base = {
  mode: "image" as const,
  prompt: "un sac en cuir",
  settings,
  resultUrl: "https://cdn.test/a.png",
  resultMode: "image" as const,
  pendingVideoId: null,
};
const img = (id: string, size = 10) => ({ id, url: "data:image/jpeg;base64," + "A".repeat(size), name: `${id}.jpg`, type: "image/jpeg" });

describe("sessionStore", () => {
  it("restitue ce qui a été enregistré", () => {
    const s = fakeStorage();
    saveStudioSession("u1", base, 1000, s);
    expect(loadStudioSession("u1", 2000, s)).toEqual({ ...base, savedAt: 1000 });
  });

  it("isole les utilisateurs", () => {
    const s = fakeStorage();
    saveStudioSession("u1", base, 1000, s);
    expect(loadStudioSession("u2", 2000, s)).toBeNull();
  });

  it("expire après 24 h et purge l'entrée", () => {
    const s = fakeStorage();
    saveStudioSession("u1", base, 1000, s);
    expect(loadStudioSession("u1", 1000 + SESSION_TTL_MS + 1, s)).toBeNull();
    expect(Object.keys(s.data)).toHaveLength(0);
  });

  it("ignore un contenu corrompu", () => {
    const s = fakeStorage({ "studio-session:u1": "{pas du json" });
    expect(loadStudioSession("u1", 0, s)).toBeNull();
    const s2 = fakeStorage({ "studio-session:u1": JSON.stringify({ mode: "audio", prompt: "x", savedAt: 0 }) });
    expect(loadStudioSession("u1", 0, s2)).toBeNull();
  });

  it("ne conserve pas une data-URL", () => {
    const s = fakeStorage();
    saveStudioSession("u1", { ...base, resultUrl: "data:image/png;base64,AAAA" }, 1000, s);
    expect(loadStudioSession("u1", 1000, s)?.resultUrl).toBeNull();
  });

  it("ne garde rien quand la session est vide", () => {
    const s = fakeStorage();
    saveStudioSession("u1", base, 1000, s);
    saveStudioSession("u1", { ...base, prompt: "  ", resultUrl: null }, 2000, s);
    expect(loadStudioSession("u1", 2000, s)).toBeNull();
  });

  it("conserve une vidéo en attente", () => {
    const s = fakeStorage();
    saveStudioSession("u1", { ...base, mode: "video", prompt: "", resultUrl: null, pendingVideoId: "v1" }, 1000, s);
    expect(loadStudioSession("u1", 1000, s)?.pendingVideoId).toBe("v1");
  });

  it("garde la nature du résultat même si le mode a changé", () => {
    const s = fakeStorage();
    saveStudioSession("u1", { ...base, mode: "video", resultMode: "image" }, 1000, s);
    const loaded = loadStudioSession("u1", 1000, s);
    expect(loaded?.mode).toBe("video");
    expect(loaded?.resultMode).toBe("image");
  });

  it("relit une ancienne session sans resultMode ni réglages", () => {
    const old = { mode: "video", prompt: "x", resultUrl: "https://cdn.test/v.mp4", pendingVideoId: null, savedAt: 1000 };
    const s = fakeStorage({ "studio-session:u1": JSON.stringify(old) });
    const loaded = loadStudioSession("u1", 1000, s);
    expect(loaded?.resultMode).toBe("video");
    expect(loaded?.settings).toBeNull();
  });

  it("rejette des réglages mal formés", () => {
    const bad = { ...base, settings: { aspectRatio: 1 }, savedAt: 1000 };
    const s = fakeStorage({ "studio-session:u1": JSON.stringify(bad) });
    expect(loadStudioSession("u1", 1000, s)).toBeNull();
  });

  describe("images de référence", () => {
    it("restitue les images enregistrées", () => {
      const s = fakeStorage();
      saveStudioMedia("u1", [img("a"), img("b")], 1000, s);
      expect(loadStudioMedia("u1", 2000, s).map((m) => m.id)).toEqual(["a", "b"]);
    });

    it("expire après 24 h", () => {
      const s = fakeStorage();
      saveStudioMedia("u1", [img("a")], 1000, s);
      expect(loadStudioMedia("u1", 1000 + SESSION_TTL_MS + 1, s)).toEqual([]);
      expect(Object.keys(s.data)).toHaveLength(0);
    });

    it("ne garde rien si le total dépasse la limite", () => {
      const s = fakeStorage();
      saveStudioMedia("u1", [img("a")], 1000, s);
      saveStudioMedia("u1", [img("a", MAX_MEDIA_BYTES), img("b", 10)], 2000, s);
      expect(loadStudioMedia("u1", 2000, s)).toEqual([]);
    });

    it("efface quand la liste est vide et filtre les entrées invalides", () => {
      const s = fakeStorage();
      saveStudioMedia("u1", [img("a")], 1000, s);
      saveStudioMedia("u1", [], 2000, s);
      expect(loadStudioMedia("u1", 2000, s)).toEqual([]);
      const dirty = fakeStorage({
        "studio-media:u1": JSON.stringify({ savedAt: 0, items: [img("ok"), { id: "x", url: "https://evil/x.png", name: "x", type: "image/png" }] }),
      });
      expect(loadStudioMedia("u1", 0, dirty).map((m) => m.id)).toEqual(["ok"]);
    });

    it("tolère un stockage défaillant ou absent", () => {
      const broken = {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("quota"); },
        removeItem: () => { throw new Error("blocked"); },
      };
      expect(() => saveStudioMedia("u1", [img("a")], 0, broken)).not.toThrow();
      expect(loadStudioMedia("u1", 0, broken)).toEqual([]);
      expect(loadStudioMedia("u1", 0, null)).toEqual([]);
    });
  });

  it("ne plante pas si le stockage échoue ou est absent", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => saveStudioSession("u1", base, 0, broken)).not.toThrow();
    expect(loadStudioSession("u1", 0, broken)).toBeNull();
    expect(() => clearStudioSession("u1", broken)).not.toThrow();
    expect(loadStudioSession("u1", 0, null)).toBeNull();
  });
});
