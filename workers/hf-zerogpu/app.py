import os
import tempfile

# Import spaces before torch/diffusers so ZeroGPU can install its CUDA shim.
import spaces
import gradio as gr
import torch
from diffusers import AutoencoderKLWan, WanPipeline
from diffusers.schedulers.scheduling_unipc_multistep import UniPCMultistepScheduler
from diffusers.utils import export_to_video
from huggingface_hub import snapshot_download

MODEL_ID = os.getenv("MODEL_ID", "Wan-AI/Wan2.1-T2V-1.3B-Diffusers")
# Download and place the model at startup. ZeroGPU's startup pack handles
# module-level CUDA placement; loading lazily inside the GPU function adds
# expensive checkpoint loading to every request and can exceed the reservation.
MODEL_PATH = snapshot_download(repo_id=MODEL_ID)
vae = AutoencoderKLWan.from_pretrained(
    MODEL_PATH,
    subfolder="vae",
    torch_dtype=torch.float32,
    local_files_only=True,
)
pipe = WanPipeline.from_pretrained(
    MODEL_PATH,
    vae=vae,
    torch_dtype=torch.bfloat16,
    local_files_only=True,
)
pipe.scheduler = UniPCMultistepScheduler.from_config(
    pipe.scheduler.config,
    flow_shift=3.0,
)
pipe.to("cuda")

NEGATIVE_PROMPT = (
    "low quality, blurry, static image, distorted anatomy, extra limbs, "
    "text, subtitles, watermark, flicker, abrupt camera movement"
)


def estimate_gpu_duration(
    prompt: str, num_frames: int, seed: int, *args, **kwargs
) -> int:
    """Reserve a realistic starting budget; refine after live Space timings."""
    del prompt, seed, args, kwargs
    frames = int(num_frames)
    if frames <= 17:
        return 120
    if frames <= 33:
        return 180
    return 240


@spaces.GPU(duration=estimate_gpu_duration)
def generate_clip(prompt: str, num_frames: int, seed: int) -> str:
    prompt = (prompt or "").strip()
    if not prompt:
        raise gr.Error("Enter a scene prompt.")
    if num_frames not in (17, 33, 49):
        raise gr.Error("Choose a supported short clip length.")

    try:
        generator = torch.Generator(device="cuda").manual_seed(int(seed))
        frames = pipe(
            prompt=prompt,
            negative_prompt=NEGATIVE_PROMPT,
            height=480,
            width=832,
            num_frames=int(num_frames),
            # Low-step smoke-test settings; visual quality and runtime must be
            # checked on the actual Space before tuning these values further.
            num_inference_steps=6 if num_frames == 17 else 8 if num_frames == 33 else 10,
            guidance_scale=4.5,
            generator=generator,
        ).frames[0]

        handle, output_path = tempfile.mkstemp(suffix=".mp4")
        os.close(handle)
        export_to_video(frames, output_path, fps=16)
        return output_path
    except gr.Error:
        raise
    except Exception as exc:
        raise gr.Error(f"Video generation failed: {type(exc).__name__}: {exc}") from exc
    finally:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


with gr.Blocks(title="Bharat AI Video Worker") as demo:
    gr.Markdown(
        "# Bharat AI Video Worker\n"
        "Generate short, silent 16:9 scene clips. Audio is added in a separate stage. "
        "Model weights are downloaded and placed at startup. GPU reservations are "
        "estimated by clip length; free daily quota is limited."
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
