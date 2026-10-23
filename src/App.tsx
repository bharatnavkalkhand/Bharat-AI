import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { CreateMoviePage } from "./pages/CreateMoviePage";
import { MovieWorkspacePage } from "./pages/MovieWorkspacePage";
import { ProducePage } from "./pages/ProducePage";
import { ResearchEnginePage } from "./pages/ResearchEnginePage";
import { AvatarStudioPage } from "./pages/AvatarStudioPage";

export default function App() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateMoviePage />} />
        <Route path="/research" element={<ResearchEnginePage />} />
        <Route path="/avatar-studio" element={<AvatarStudioPage />} />
        <Route path="/movie/:movieId/produce" element={<ProducePage />} />
        <Route path="/movie/:movieId/*" element={<MovieWorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
