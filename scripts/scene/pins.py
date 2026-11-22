"""
Checks a downloaded model against its sha256 pin in assets.json before Blender imports it.

Each model is a zip in ~/Portfolio-assets/downloads, extracted to a folder of the same name. The
zip must match its pin, and every extracted file must match the zip byte for byte (a missing file
is extracted from it), so the glTF Blender reads is exactly what was pinned. Downloads are
untrusted: member paths that would land outside the folder are refused.
"""

import hashlib
import json
import zipfile
from pathlib import Path, PurePosixPath


class PinError(Exception):
    pass


def verify_download(downloads: Path, file: str, sha256: str) -> Path:
    folder = PurePosixPath(file).parts[0]
    zpath = downloads / f"{folder}.zip"
    if not zpath.exists():
        raise PinError(f"{zpath}: missing (download it from the source in docs/ASSETS.md)")
    digest = hashlib.sha256(zpath.read_bytes()).hexdigest()
    if digest != sha256:
        raise PinError(f"{zpath}: sha256 {digest} does not match the pin {sha256}")
    root = downloads / folder
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            name = PurePosixPath(info.filename)
            if name.is_absolute() or ".." in name.parts:
                raise PinError(f"{zpath}: unsafe member path {info.filename!r}")
            if info.is_dir():
                continue
            target = root.joinpath(*name.parts)
            data = z.read(info)
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            elif target.read_bytes() != data:
                raise PinError(f"{target}: differs from the pinned zip")
    path = downloads / file
    if not path.exists():
        raise PinError(f"{path}: not in the pinned zip")
    return path


def verify_files(downloads: Path, file: str, files: dict) -> Path:
    """A loose download (Poly Haven ships its glTF as separate files): every file in files (paths
    relative to the glTF's folder, each with its sha256) must exist and match, and every buffer and
    image the glTF names must be one of them. Returns the glTF's path."""
    gltf = downloads / file
    folder = gltf.parent
    for rel, sha in files.items():
        p = PurePosixPath(rel)
        if p.is_absolute() or ".." in p.parts:
            raise PinError(f"{rel!r}: unsafe path")
        target = folder.joinpath(*p.parts)
        if not target.exists():
            raise PinError(f"{target}: missing (download it from the source in docs/ASSETS.md)")
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if digest != sha:
            raise PinError(f"{target}: sha256 {digest} differs from the pin {sha}")
    name = PurePosixPath(file).name
    if name not in files:
        raise PinError(f"{name}: the glTF itself is not pinned")
    doc = json.loads(gltf.read_text())
    for kind in ("buffers", "images"):
        for item in doc.get(kind, []):
            uri = item.get("uri")
            if uri and not uri.startswith("data:") and uri not in files:
                raise PinError(f"{uri}: named by the glTF but not pinned")
    return gltf
