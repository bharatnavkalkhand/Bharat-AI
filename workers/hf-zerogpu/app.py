import os
import tempfile
from typing import Optional

import gradio as gr
import spaces
import torch
from diffusers import AutoencoderKLWan, WanPipeline
from diffusers.schedulers.scheduling_unipc_multistep import UniPCMultistepScheduler
from diffusers.utils import export_to_video

MODEL_ID = os.getenv("MODEL_ID", "Wan-AI/Wan2.1-T2V-1.3B-Diffusers")
NEGATIVE_PROMPT = (
    "low quality, blurry, static image, distorted anatomy, extra limbs, "
    "text, subtitles, watermark, flicker, abrupt camera movement"
)

# IMPORTANT: ZeroGPU only grants CUDA access while a @spaces.GPU function runs.
# Do not load the model or call pipe.to("cuda") at module import time, or the
# Space can fail before a GPU allocation is available.
pipe: Optional[WanPipeline] = None


def get_pipeline() -> WanPipeline:
    global pipe
    if pipe is None:
        vae = AutoencoderKLWan.from_pretrained(
            MODEL_ID,
            subfolder="vae",
            torch_dtype=torch.float32,
        )
        loaded = WanPipeline.from_pretrained(
            MODEL_ID,
            vae=vae,
            torch_dtype=torch.bfloat16,
        )
        loaded.scheduler = UniPCMultistepScheduler.from_config(
            loaded.scheduler.config,
            flow_shift=3.0,
        )
        loaded.to("cuda")
        pipe = loaded
    return pipe


@spaces.GPU(duration=240)
def generate_clip(prompt: str, num_frames: int, seed: int) -> str:
    prompt = (prompt or "").strip()
    if not prompt:
        raise gr.Error("Enter a scene prompt.")
    if num_frames not in (17, 33, 49):
        raise gr.Error("Choose a supported short clip length.")

    try:
        pipeline = get_pipeline()
        generator = torch.Generator(device="cuda").manual_seed(int(seed))
        frames = pipeline(
            prompt=prompt,
            negative_prompt=NEGATIVE_PROMPT,
            height=480,
            width=832,
            num_frames=int(num_frames),
            num_inference_steps=16,
            guidance_scale=5.0,
            generator=generator,
        ).frames[0]

        handle, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(handle)
        export_to_video(frames, output_path, fps=16)
        return output_path
    except gr.Error:
        raise
    except Exception as exc:
        # Show a useful failure in the Gradio UI/API rather than a blank result.
        raise gr.Error(f"Video generation failed: {type(exc).__name__}: {exc}") from exc
    finally:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


with gr.Blocks(title="Bharat AI Video Worker") as demo:
    gr.Markdown(
        "# Bharat AI Video Worker\n"
        "Generate short, silent 16:9 scene clips. Audio is added in a separate stage. "
        "The model loads on the first GPU request, not at app startup."
    )
    prompt = gr.Textbox(
        label="Scene prompt",
        lines=5,
        placeholder="Describe one shot: subject, action, setting, lighting, and camera movement.",
    )
    num_frames = gr.Dropdown(
        choices=[17, 33, 49],
        value=33,
        label="Clip length (frames at 16 fps)",
    )
    seed = gr.Number(value=42, precision=0, label="Seed")
    generate = gr.Button("Generate 16:9 clip", variant="primary")
    video = gr.Video(label="Generated silent video")

    generate.click(
        fn=generate_clip,
        inputs=[prompt, num_frames, seed],
        outputs=video,
        api_name="generate",
        concurrency_limit=1,
    )

demo.queue().launch()
