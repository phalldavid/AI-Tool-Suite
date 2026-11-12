"""Bakes environment pictures into the app.

Takes the env-previews.json from "Export for the app" (Environment > Pictures)
and writes web/public/previews/env-<id>.webp at 320 x 240, the same size as the
style pictures. The next build lists them automatically.

    python3 scripts/import-env-previews.py path/to/env-previews.json
"""

import base64
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "previews"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if data.get("kind") != "env-previews":
        sys.exit("That file is not an environment pictures export.")
    n = 0
    for env_id, url in data.get("tiles", {}).items():
        if not re.fullmatch(r"[a-z0-9-]+", env_id) or not isinstance(url, str) or "," not in url:
            continue
        img = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
        # Centre-crop to 4:3, then 320 x 240 like the style pictures.
        w, h = img.size
        tw = min(w, round(h * 4 / 3))
        th = round(tw * 3 / 4)
        left, top = (w - tw) // 2, (h - th) // 2
        img = img.crop((left, top, left + tw, top + th)).resize((320, 240), Image.LANCZOS)
        img.save(OUT / f"env-{env_id}.webp", "WEBP", quality=82, method=6)
        n += 1
    print(f"Wrote {n} environment pictures to {OUT}")


if __name__ == "__main__":
    main()
