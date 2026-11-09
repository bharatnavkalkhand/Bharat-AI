import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Character,
  Language,
  Movie,
  MovieDuration,
  Scene,
  SceneMood,
} from "@/lib/types";
import type { ScriptOutput } from "@/lib/script-engine";

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

type MovieStore = {
  movies: Movie[];
  currentMovieId: string | null;
  createMovie: (input: {
    title?: string;
    idea?: string;
    language?: Language;
    targetDuration?: MovieDuration;
    genres?: string[];
  }) => Movie;
  setCurrentMovie: (id: string | null) => void;
  updateMovie: (id: string, patch: Partial<Movie>) => void;
  deleteMovie: (id: string) => void;
  addCharacter: (
    movieId: string,
    char: Omit<Character, "id"> & { id?: string },
  ) => void;
  updateCharacter: (
    movieId: string,
    characterId: string,
    patch: Partial<Character>,
  ) => void;
  removeCharacter: (movieId: string, characterId: string) => void;
  addScene: (
    movieId: string,
    scene: Partial<Scene> & { title?: string; mood?: SceneMood },
  ) => void;
  updateScene: (movieId: string, sceneId: string, patch: Partial<Scene>) => void;
  removeScene: (movieId: string, sceneId: string) => void;
  applyScriptResult: (
    movieId: string,
    result: ScriptOutput,
    opts?: { replaceCast?: boolean; replaceScenes?: boolean },
  ) => void;
};

export const useMovieStore = create<
  MovieStore
>()(
  persist(
    (set) => ({
      movies: [],
      currentMovieId: null,

      createMovie: ({
        title,
        idea,
        language = "hi",
        targetDuration = "5min",
        genres = [],
      }) => {
        const now = new Date().toISOString();
        const movie: Movie = {
          id: uid(),
          title: title?.trim() || "Untitled Movie",
          synopsis: idea?.trim() || "",
          language,
          targetDuration,
          genres,
          characters: [],
          scenes: [],
          createdAt: now,
          updatedAt: now,
          status: "draft",
        };

        set((s) => ({
          movies: [movie, ...s.movies],
          currentMovieId: movie.id,
        }));

        return movie;
      },

      setCurrentMovie: (id) => set({ currentMovieId: id }),

      updateMovie: (id, patch) =>
        set((s) => ({
          movies: s.movies.map((m) =>
            m.id === id
              ? { ...m, ...patch, updatedAt: new Date().toISOString() }
              : m,
          ),
        })),

      deleteMovie: (id) =>
        set((s) => ({
          movies: s.movies.filter((m) => m.id !== id),
          currentMovieId:
            s.currentMovieId === id ? null : s.currentMovieId,
        })),

      addCharacter: (movieId, char) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            const full: Character = {
              id: char.id || uid(),
              name: char.name || "",
              role: char.role || "",
              appearance: char.appearance || "",
              personality: char.personality,
              referenceImageLocal: char.referenceImageLocal,
              referenceImageUrl: char.referenceImageUrl,
            };
            return {
              ...m,
              characters: [...m.characters, full],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      updateCharacter: (movieId, characterId, patch) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            return {
              ...m,
              characters: m.characters.map((c) =>
                c.id === characterId ? { ...c, ...patch } : c,
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      removeCharacter: (movieId, characterId) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            return {
              ...m,
              characters: m.characters.filter((c) => c.id !== characterId),
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      addScene: (movieId, scene) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            const order =
              m.scenes.length === 0
                ? 0
                : Math.max(...m.scenes.map((x) => x.order)) + 1;
            const full: Scene = {
              id: uid(),
              status: "draft",
              order,
              title: scene.title || `Scene ${order + 1}`,
              mood: scene.mood || "neutral",
              dialogue: scene.dialogue,
              narration: scene.narration,
              gestureNotes: scene.gestureNotes,
              visualPrompt: scene.visualPrompt,
              characterIds: scene.characterIds || [],
              imageTopLocal: scene.imageTopLocal,
              imageBottomLocal: scene.imageBottomLocal,
              audioLocal: scene.audioLocal,
              externalVideoLocal: scene.externalVideoLocal,
              estimatedDurationSec: scene.estimatedDurationSec,
            };
            return {
              ...m,
              scenes: [...m.scenes, full],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      updateScene: (movieId, sceneId, patch) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            return {
              ...m,
              scenes: m.scenes.map((sc) =>
                sc.id === sceneId ? { ...sc, ...patch } : sc,
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      removeScene: (movieId, sceneId) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            return {
              ...m,
              scenes: m.scenes.filter((sc) => sc.id !== sceneId),
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      applyScriptResult: (movieId, result, opts) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            const replaceCast = opts?.replaceCast !== false;
            const replaceScenes = opts?.replaceScenes !== false;

            const characters: Character[] = replaceCast
              ? result.characters.map((c) => ({
                  id: uid(),
                  name: c.name,
                  role: c.role,
                  appearance: c.appearance,
                  personality: c.personality,
                }))
              : m.characters;

            const allCastIds = characters.map((c) => c.id);

            const scenes: Scene[] = replaceScenes
              ? result.scenes.map((sc, order) => {
                  const matchedIds = characters
                    .filter((c) =>
                      (sc.dialogue || "")
                        .toLowerCase()
                        .includes(c.name.toLowerCase()),
                    )
                    .map((c) => c.id);
                  return {
                    id: uid(),
                    status: "draft",
                    order,
                    title: sc.title,
                    mood: sc.mood,
                    dialogue: sc.dialogue,
                    narration: sc.narration,
                    gestureNotes: sc.gestureNotes,
                    visualPrompt: sc.visualPrompt,
                    characterIds:
                      matchedIds.length > 0 ? matchedIds : allCastIds.slice(0, 2),
                    estimatedDurationSec: sc.estimatedDurationSec,
                  };
                })
              : m.scenes;

            return {
              ...m,
              title: result.title || m.title,
              synopsis: result.synopsis || m.synopsis,
              characters,
              scenes,
              updatedAt: new Date().toISOString(),
              status: "planning" as const,
            };
          }),
        })),
    }),
    { name: "bharat-ai-movies" },
  ),
);
