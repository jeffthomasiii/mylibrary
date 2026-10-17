"""Render installable PNG icons from the canonical MyLibrary SVG logo."""
from pathlib import Path
import cairosvg

source = Path("public/icon.svg").read_bytes()
for size in (192, 512):
    cairosvg.svg2png(bytestring=source, write_to=f"public/icon-{size}.png", output_width=size, output_height=size)
