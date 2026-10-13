import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Movie,
  Character,
  Scene,
  MovieDuration,
  Language,
  SceneMood,
} from "@/lib/types";

interface MovieState {
  movies: Movie[];
  currentMovieId: string | null;

  createMovie: (opts: {
    title?: string;
    idea?: string;
    language?: Language;
    targetDuration?: MovieDuration;
    genres?: string[];
  }) => Movie;
  setCurrentMovie: (id: string | null) => void;
  updateMovie: (id: string, patch: Partial<Movie>) => void;
  addCharacter: (movieId: string, character: Omit<Character, "id">) => Character;
  updateCharacter: (
    movieId: string,
    characterId: string,
    patch: Partial<Character>,
  ) => void;
  removeCharacter: (movieId: string, characterId: string) => void;
  addScene: (
    movieId: string,
    scene: Omit<Scene, "id" | "order">,
  ) => Scene;
  updateScene: (
    movieId: string,
    sceneId: string,
    patch: Partial<Scene>,
  ) => void;
  removeScene: (movieId: string, sceneId: string) => void;
  reorderScenes: (movieId: string, sceneIds: string[]) => void;
  deleteMovie: (id: string) => void;
}

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}

export const useMovieStore = create<MovieState>()(
  persist(
    (set, get) => ({
      movies: [],
      currentMovieId: null,

      createMovie: ({
        title,
        idea,
        language = "en",
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

      addCharacter: (movieId, character) => {
        const id = uid();
        const full: Character = { ...character, id };
        set((s) => ({
          movies: s.movies.map((m) =>
            m.id === movieId
              ? {
                  ...m,
                  characters: [...m.characters, full],
                  updatedAt: new Date().toISOString(),
                }
              : m,
          ),
        }));
        return full;
      },

      updateCharacter: (movieId, characterId, patch) =>
        set((s) => ({
          movies: s.movies.map((m) =>
            m.id === movieId
              ? {
                  ...m,
                  characters: m.characters.map((c) =>
                    c.id === characterId ? { ...c, ...patch } : c,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : m,
          ),
        })),

      removeCharacter: (movieId, characterId) =>
        set((s) => ({
          movies: s.movies.map((m) =>
            m.id === movieId
              ? {
                  ...m,
                  characters: m.characters.filter((c) => c.id !== characterId),
                  scenes: m.scenes.map((sc) => ({
                    ...sc,
                    characterIds: sc.characterIds.filter(
                      (id) => id !== characterId,
                    ),
                  })),
                  updatedAt: new Date().toISOString(),
                }
              : m,
          ),
        })),

      addScene: (movieId, scene) => {
        const id = uid();
        let created: Scene | null = null;
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            const order = m.scenes.length;
            created = {
              ...scene,
              id,
              order,
              status: scene.status ?? "draft",
              mood: (scene.mood as SceneMood) ?? "neutral",
              characterIds: scene.characterIds ?? [],
            };
            return {
              ...m,
              scenes: [...m.scenes, created!],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        return created!;
      },

      updateScene: (movieId, sceneId, patch) =>
        set((s) => ({
          movies: s.movies.map((m) =>
            m.id === movieId
              ? {
                  ...m,
                  scenes: m.scenes.map((sc) =>
                    sc.id === sceneId ? { ...sc, ...patch } : sc,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : m,
          ),
        })),

      removeScene: (movieId, sceneId) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            const remaining = m.scenes
              .filter((sc) => sc.id !== sceneId)
              .map((sc, idx) => ({ ...sc, order: idx }));
            return {
              ...m,
              scenes: remaining,
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      reorderScenes: (movieId, sceneIds) =>
        set((s) => ({
          movies: s.movies.map((m) => {
            if (m.id !== movieId) return m;
            const map = new Map(m.scenes.map((sc) => [sc.id, sc]));
            const reordered = sceneIds
              .map((id, index) => {
                const sc = map.get(id);
                return sc ? { ...sc, order: index } : null;
              })
              .filter(Boolean) as Scene[];
            return {
              ...m,
              scenes: reordered,
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      deleteMovie: (id) =>
        set((s) => ({
          movies: s.movies.filter((m) => m.id !== id),
          currentMovieId:
            s.currentMovieId === id ? null : s.currentMovieId,
        })),
    }),
    {
      name: "bharat-ai-movies",
      partialize: (s) => ({
        movies: s.movies,
        currentMovieId: s.currentMovieId,
      }),
    },
  ),
);

export function useCurrentMovie() {
  const currentMovieId = useMovieStore((s) => s.currentMovieId);
  const movies = useMovieStore((s) => s.movies);
  return movies.find((m) => m.id === currentMovieId) ?? null;
}
