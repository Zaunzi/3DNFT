"""Assemble the homepage character reel from the authored collection renders."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
out = root / 'app/public/art'
out.mkdir(exist_ok=True)
ids = [1, 2, 12, 23, 32, 46, 77, 98, 105, 128, 156, 203, 247, 312, 426, 500]
frames = [Image.open(root / f'app/public/cryptodoodz/images/{i:04d}.png').convert('RGB').resize((420, 420), Image.Resampling.LANCZOS) for i in ids]
frames[0].save(out / 'cryptodoodz-reel.png', optimize=True)
frames[0].save(out / 'cryptodoodz-reel.gif', save_all=True, append_images=frames[1:], duration=630, loop=0, optimize=True, disposal=2)
with Image.open(out / 'cryptodoodz-reel.gif') as result:
    assert result.n_frames == len(ids)
    assert result.info['loop'] == 0
    for i in range(result.n_frames):
        result.seek(i)
        assert result.info['duration'] == 630
print(f'{len(ids)} frames, {(out / "cryptodoodz-reel.gif").stat().st_size:,} bytes')
