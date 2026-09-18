import os
from pathlib import Path

import cv2

from app.vectorstore.vector_store import VectorStore
from insightface.app import FaceAnalysis


# Load InsightFace
face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=-1, det_size=(640, 640))


def test_add_images_from_images_folder():
    """Loop through images/ folder, detect face embeddings and add to VectorStore."""
    project_root = Path(__file__).resolve().parents[1]
    images_dir = project_root / "images"

    if not images_dir.exists():
        raise FileNotFoundError(f"Images folder not found: {images_dir}")

    store = VectorStore()
    # ensure collection exists
    store.create_collection()

    for img_path in sorted(images_dir.iterdir()):
        if not img_path.is_file():
            continue
        # basic image extensions filter
        if img_path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.bmp'}:
            continue

        image = cv2.imread(str(img_path))
        if image is None:
            print(f"Warning: failed to read image {img_path}")
            continue

        faces = face_app.get(image)
        if not faces:
            print(f"No faces detected in {img_path}, skipping.")
            continue

        embedding = faces[0].embedding

        person_name = img_path.stem
        store.add_embedding(embedding=embedding, person_name=person_name)


if __name__ == '__main__':
    test_add_images_from_images_folder()