import { useState } from "react";
import { Image, Layers3, MessageSquareText, Scale, Workflow, CheckCircle2, ExternalLink } from "lucide-react";

type WorkflowId = "magic-hour" | "byteplus" | "canva" | "arena" | "flow";

const workflows: Array<{
  id: WorkflowId;
  name: string;
  icon: typeof Image;
  title: string;
  description: string;
  steps: string[];
  status: string;
}> = [
  { id: "magic-hour", name: "Magic Hour", icon: Image, title: "Image-first video", description: "Start with a still image, then animate it into a short scene using the connected Bharat AI worker.", steps: ["Choose or import a reference image in Scene Board", "Write the motion prompt in the scene", "Generate the clip with the configured worker"], status: "Workflow pattern available · Magic Hour service not connected" },
  { id: "byteplus", name: "BytePlus", icon: Layers3, title: "Model playground", description: "A single place to inspect the active engine and compare supported worker routes. External BytePlus models are not connected.", steps: ["Choose the worker in Director Controls", "Check its availability and limits", "Run the same scene prompt to compare results"], status: "Worker routing available · BytePlus API not connected" },
  { id: "canva", name: "Canva", icon: MessageSquareText, title: "Prompt-led creation", description: "Use the movie script and scene prompts as a conversational brief, then create and refine each scene in Bharat AI.", steps: ["Edit the script and scene descriptions", "Refine visual prompts in Scene Board", "Generate and review returned MP4 clips"], status: "Prompt workflow available · Canva service not connected" },
  { id: "arena", name: "Arena", icon: Scale, title: "Compare outputs", description: "Generate separate attempts with the available worker and review the resulting MP4s in the output list. No Arena model endpoint is connected.", steps: ["Keep a scene prompt consistent", "Run separate generation attempts", "Compare the actual returned clips below"], status: "Manual output review available · Arena service not connected" },
  { id: "flow", name: "Google Flow", icon: Workflow, title: "Project and scene canvas", description: "Organize a film as ordered scenes with character references, prompts and individual generated clips.", steps: ["Arrange scenes in your movie workspace", "Attach character and image references", "Generate clips and review the scene sequence"], status: "Bharat AI scene workflow available · Google Flow service not connected" },
];

export function VideoWorkflowStudio() {
  const [active, setActive] = useState<WorkflowId>(() => {
    if (typeof localStorage === "undefined") return "flow";
    const saved = localStorage.getItem("bharat_video_workflow");
    return workflows.some((item) => item.id === saved) ? saved as WorkflowId : "flow";
  });
  const selected = workflows.find((item) => item.id === active) ?? workflows[4];
  const Icon = selected.icon;

  function choose(id: WorkflowId) {
    setActive(id);
    localStorage.setItem("bharat_video_workflow", id);
  }

  return (
    <section className="card-pro mb-5 space-y-3 p-3" aria-label="Unified video workflow studio">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Unified Video Studio</p>
          <p className="text-[11px] text-muted">Five creative workflows · one Bharat AI pipeline</p>
        </div>
        <span className="rounded-full border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-400">₹0 software path</span>
      </div>
      <div className="grid grid-cols-5 gap-1" role="tablist" aria-label="Choose a workflow">
        {workflows.map((item) => {
          const ItemIcon = item.icon;
          const selectedTab = active === item.id;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={selectedTab}
              onClick={() => choose(item.id)}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center text-[10px] ${selectedTab ? "border-accent bg-accent/10 text-fg" : "border-border text-muted"}`}>
              <ItemIcon className="h-4 w-4" />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border border-border bg-bg/60 p-3" role="tabpanel">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">{selected.title}</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{selected.description}</p>
        <ol className="mt-3 space-y-2">
          {selected.steps.map((step, index) => (
            <li key={step} className="flex gap-2 text-xs">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-border text-[10px]">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-2 text-[10px] leading-relaxed text-muted">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />{selected.status}
        </p>
      </div>
      <p className="text-[10px] leading-relaxed text-muted">
        These are unified Bharat AI workflow modes, not embedded copies of the five commercial services. Their free quotas and model access do not transfer to Bharat AI. Actual AI video is generated only when a connected worker returns an MP4.
      </p>
    </section>
  );
}
