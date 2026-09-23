"""Build a reproducible, dependency-free download of the course examples."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = ROOT / "public" / "tutorials" / "backend-to-platform"
FILES = (
    "README.md",
    "index.html",
    "prompts.md",
    "resources.json",
    "lab/index.html",
    "lab/lab.js",
    "lab/styles.css",
    "02-html/index.html",
    "03-css/index.html",
    "03-css/styles.css",
)


def main():
    # Read every input first so a missing file cannot leave a partial archive.
    sources = [(name, (EXAMPLES / name).read_bytes()) for name in FILES]
    destination = EXAMPLES / "source.zip"
    with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
        for name, content in sources:
            entry = ZipInfo(f"backend-to-platform/{name}", (2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content)
    print(f"Packaged {len(sources)} tutorial files into {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
