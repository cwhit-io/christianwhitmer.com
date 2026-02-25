import urllib.request
from pathlib import Path
import requests as _requests
from .prompt_templates import build_image_prompt

MONICA_BASE_URL = "https://openapi.monica.im/v1"


def generate_header_image(
    api_key: str, flux_model: str, row: dict, post_dir: Path
) -> str:
    print(f"  Generating header image ({flux_model})… ", end="", flush=True)
    prompt = build_image_prompt(row)
    try:
        resp = _requests.post(
            f"{MONICA_BASE_URL}/image/gen/flux",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"model": flux_model, "prompt": prompt, "size": "1344x768"},
            timeout=120,
        )
        resp.raise_for_status()
        image_url = resp.json()["data"][0]["url"]
        ext = Path(image_url.split("?")[0]).suffix or ".jpg"
        filename = f"header{ext}"
        dest = post_dir / filename
        urllib.request.urlretrieve(image_url, dest)
        print(f"done ({filename}).")
        return filename
    except Exception as e:
        print(f"failed: {e}")
        return ""
