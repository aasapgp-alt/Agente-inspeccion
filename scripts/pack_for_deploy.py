import os
import tarfile

EXCLUDE_DIRS = {
    '.git', 'venv', '.venv', 'node_modules', '.next', 'out',
    '__pycache__', '.pytest_cache', 'extracted_media',
    'Informes_Generados', 'scratch', 'frontend', '.cache',
    'reportes', 'docs', 'tests', 'fotos', 'audios'
}

EXCLUDE_EXTS = {'.pyc', '.pyo', '.pyd', '.tar.gz', '.key', '.bak', '.pdf', '.docx.bak'}

def should_exclude(path):
    parts = os.path.normpath(path).split(os.sep)
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    _, ext = os.path.splitext(path)
    if ext in EXCLUDE_EXTS:
        return True
    if 'data' in parts and ('fotos' in parts or 'audios' in parts or 'reportes' in parts or 'libros' in parts):
        return True
    return False

def make_tarfile(output_filename, source_dir):
    with tarfile.open(output_filename, "w:gz") as tar:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, source_dir)
                if not should_exclude(rel_path):
                    tar.add(full_path, arcname=rel_path)
                    print(f"Added: {rel_path}")

if __name__ == "__main__":
    out = "deploy_backend.tar.gz"
    make_tarfile(out, ".")
    size = os.path.getsize(out) / (1024 * 1024)
    print(f"\n[OK] Package created: {out} ({size:.2f} MB)")
