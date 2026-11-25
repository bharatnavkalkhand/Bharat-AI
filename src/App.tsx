import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { CreateMoviePage } from "./pages/CreateMoviePage";
import { MovieWorkspacePage } from "./pages/MovieWorkspacePage";
import { ProducePage } from "./pages/ProducePage";
import { GeneratePage } from "./pages/GeneratePage";
import { DramaClawPage } from "./pages/DramaClawPage";
import { AiProvidersPage } from "./pages/AiProvidersPage";
import { Link } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="fixed bottom-3 right-3 z-50 flex gap-2"><Link to="/ai-providers" className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold shadow-lg">AI Modes</Link><Link to="/dramaclaw" className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold shadow-lg">DramaClaw ↗</Link></div>
      <Routes>
        <Route path="/dramaclaw" element={<DramaClawPage />} />
        <Route path="/ai-providers" element={<AiProvidersPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/create" element={<CreateMoviePage />} />
        <Route path="/movie/:movieId/produce" element={<ProducePage />} />
        <Route path="/movie/:movieId/*" element={<MovieWorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
async function handleAutoProduce(story: string, lang: Language) {
  setIsGenerating(true);
  setActiveTab("studio");
  try {
    // 1. Idea -> Real LLM Script & Scene Prompts
    setScriptGenPhase("1/4 • AI Director planning scenes & prompts...");
    const { script, cast } = await runAgentPipeline(
      story,
      lang,
      project.cast,
      (phase) => setScriptGenPhase(phase)
    );

    let workingScenes = [...script];
    const baseProject: Project = {
      ...project,
      title: story.slice(0, 40).trim() || project.title,
      storyIdea: story,
      language: lang,
      cast,
      scenes: workingScenes,
      updatedAt: Date.now(),
    };
    setProject(baseProject);

    // 2. Auto-Generate Images & Hindi/English Vocals for every scene
    for (let i = 0; i < workingScenes.length; i++) {
      const s = workingScenes[i];
      const speaker = cast.find((c) => c.id === s.characterId) || cast[0];
      setScriptGenPhase(`2/4 • Producing Scene ${i + 1}/${workingScenes.length} (Visual + Voice)...`);

      const [imgResult, voiceResult] = await Promise.allSettled([
        generateImage(s.visualPrompt, s.id, speaker?.referenceImageUrl),
        generateVoice(s.dialogue || s.narration || s.visualPrompt, lang, speaker),
      ]);

      workingScenes[i] = {
        ...s,
        referenceImageUrl: imgResult.status === "fulfilled" ? imgResult.value : s.referenceImageUrl,
        audioUrl: voiceResult.status === "fulfilled" ? voiceResult.value : s.audioUrl,
      };
      setProject((prev) => ({ ...prev, scenes: [...workingScenes] }));
    }

    // 3. Auto-Generate Motion / Video Clips (or 3D Depth Render)
    setScriptGenPhase("3/4 • Generating motion & 3D scene clips...");
    for (let i = 0; i < workingScenes.length; i++) {
      const s = workingScenes[i];
      const speaker = cast.find((c) => c.id === s.characterId);
      try {
        const videoUrl = await generateSceneVideo(
          s.visualPrompt,
          s.id,
          s.characterId,
          s.referenceImageUrl,
          speaker,
          lang
        );
        workingScenes[i] = { ...s, videoUrl };
        setProject((prev) => ({ ...prev, scenes: [...workingScenes] }));
      } catch (err) {
        // Keep generated image + 3D parallax fallback if GPU space is busy
        console.warn(`Scene ${i + 1} video fallback:`, err);
      }
    }

    // 4. Auto Quality Audit & Save
    setScriptGenPhase("4/4 • Quality Agent verifying final film...");
    setProject((prev) => {
      const audited = { ...prev, scenes: workingScenes, updatedAt: Date.now() };
      return { ...audited, qualityAudit: runSceneQualityAudit(audited) };
    });

    toast("Autopilot complete! Your movie is ready to preview & share.", "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "Autopilot failed.", "error");
  } finally {
    setIsGenerating(false);
    setScriptGenPhase("");
  }
}