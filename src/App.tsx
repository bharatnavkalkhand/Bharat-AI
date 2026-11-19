import { Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { HomePage } from "./pages/HomePage";
import { CreateMoviePage } from "./pages/CreateMoviePage";
import { MovieWorkspacePage } from "./pages/MovieWorkspacePage";
import { ProducePage } from "./pages/ProducePage";
import { GeneratePage } from "./pages/GeneratePage";

export default function App() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/create" element={<CreateMoviePage />} />
        <Route path="/movie/:movieId/produce" element={<ProducePage />} />
        <Route path="/movie/:movieId/*" element={<MovieWorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </div>
  );
}
