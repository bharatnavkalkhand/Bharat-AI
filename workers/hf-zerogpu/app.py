import os
import tempfile

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

vae = AutoencoderKLWan.from_pretrained(
    MODEL_ID,
    subfolder="vae",
    torch_dtype=torch.float32,
)
pipe = WanPipeline.from_pretrained(
    MODEL_ID,
    vae=vae,
    torch_dtype=torch.bfloat16,
)
pipe.scheduler = UniPCMultistepScheduler.from_config(
    pipe.scheduler.config,
    flow_shift=3.0,
)
pipe.to("cuda")


@spaces.GPU(duration=240)
def generate_clip(prompt: str, num_frames: int, seed: int) -> str:
    prompt = (prompt or "").strip()
    if not prompt:
        raise gr.Error("Enter a scene prompt.")
    if num_frames not in (17, 33, 49):
        raise gr.Error("Choose a supported short clip length.")

    generator = torch.Generator(device="cuda").manual_seed(int(seed))
    try:
        frames = pipe(
            prompt=prompt,
            negative_prompt=NEGATIVE_PROMPT,
            height=480,
            width=832,
            num_frames=num_frames,
            num_inference_steps=16,
            guidance_scale=5.0,
            generator=generator,
        ).frames[0]

        handle, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(handle)
        export_to_video(frames, output_path, fps=16)
        return output_path
    finally:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


with gr.Blocks(title="Bharat AI Video Worker") as demo:
    gr.Markdown(
        "# Bharat AI Video Worker\n"
        "Generate short, silent 16:9 scene clips. Audio is added in a separate stage."
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
