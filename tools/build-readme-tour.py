"""Build a small animated walkthrough from the real documentation screenshots.

Run after refreshing the screenshots: python tools/build-readme-tour.py
Requires Pillow: python -m pip install Pillow
This assembles captured views; it does not simulate functionality or generate UI.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots"
NAMES = ["01-landing", "04-hex-editor", "06-signature-analysis",
         "07-threat-intelligence", "08-forensics-lab", "10-injector-library",
         "11-connect-back-builder", "13-pe-analysis", "12-pdf-report"]
SIZE = (960, 540)
views = []
for name in NAMES:
    with Image.open(SHOTS / f"{name}.png") as source:
        image = ImageOps.contain(source.convert("RGB"), SIZE, Image.Resampling.LANCZOS)
        frame = Image.new("RGB", SIZE, "#f3f1eb")
        frame.paste(image, ((SIZE[0] - image.width) // 2, (SIZE[1] - image.height) // 2))
        views.append(frame)

palette_source = Image.new("RGB", (320 * len(views), 180))
for i, view in enumerate(views):
    palette_source.paste(view.resize((320, 180)), (i * 320, 0))
palette = palette_source.quantize(colors=128)
frames, durations = [], []
for i, view in enumerate(views):
    frames.append(view.quantize(palette=palette, dither=Image.Dither.NONE))
    durations.append(2000)
    following = views[(i + 1) % len(views)]
    for step in range(1, 5):
        frames.append(Image.blend(view, following, step / 5).quantize(palette=palette, dither=Image.Dither.NONE))
        durations.append(70)

output = SHOTS / "hexforge-tour.gif"
frames[0].save(output, save_all=True, append_images=frames[1:], duration=durations,
               loop=0, optimize=True, disposal=1)
print(f"Saved {output.name}: {output.stat().st_size / 1024 / 1024:.2f} MiB, {len(frames)} frames")

# A separately recorded sequence preserves the site's actual motion and frame timing.
motion_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else SHOTS / ".motion-frames"
recorded = sorted([*motion_dir.glob("frame-*.png"), *motion_dir.glob("frame-*.jpg")])
if recorded:
    captures = [Image.open(path).convert("RGB") for path in recorded]
    motion_palette = captures[0].quantize(colors=192)
    motion = [image.quantize(palette=motion_palette, dither=Image.Dither.NONE) for image in captures]
    timing_path = motion_dir / "times.json"
    timing = json.loads(timing_path.read_text()) if timing_path.exists() else []
    delays = [max(20, min(500, timing[i + 1] - timing[i])) for i in range(len(timing) - 1)]
    if len(delays) != len(motion) - 1:
        delays = [100] * (len(motion) - 1)
    delays.append(delays[-1] if delays else 100)
    motion_output = SHOTS / "landing-motion.gif"
    motion[0].save(motion_output, save_all=True, append_images=motion[1:],
                   duration=delays, loop=0, optimize=True, disposal=1)
    print(f"Saved {motion_output.name}: {motion_output.stat().st_size / 1024 / 1024:.2f} MiB, {len(motion)} recorded frames")
