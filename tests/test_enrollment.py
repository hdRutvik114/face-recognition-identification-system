import argparse
import logging
import os
import re
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.service.enrollment_service import EnrollmentService
from app.logging_utils import log_run_start, log_message, log_run_end

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Map normalized key names to clean display names
DISPLAY_NAME_OVERRIDES = {
    "sundar": "Sundar Pichai",
    "yan_lecun": "Yann LeCun",
    "ilyasutskiver": "Ilya Sutskever",
    "andrew_karpathy": "Andrew Karpathy",
    "ananyapandey": "Ananya Pandey",
    "dario": "Dario Amodei",
    "darshan": "Darshan",
    "dhoni": "MS Dhoni",
    "elon": "Elon Musk",
    "micheal": "Michael",
    "rohit": "Rohit Sharma",
    "sam": "Sam Altman",
    "virat": "Virat Kohli",
}


def get_display_name(person_key: str) -> str:
    key_lower = person_key.lower().strip()
    if key_lower in DISPLAY_NAME_OVERRIDES:
        return DISPLAY_NAME_OVERRIDES[key_lower]
    return re.sub(r"[_-]+", " ", person_key).strip().title()


def group_images_by_person(dataset_path: Path) -> dict[str, list[str]]:
    """
    Groups images in dataset_path by person identity.
    Supports both:
    1. Subfolder structure (dataset_dir/person_name/img1.jpg)
    2. Flat directory structure with numbered names (dataset_dir/sundar1.jpeg, dataset_dir/sundar2.jpeg)
    """
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
    groups = {}

    subdirs = sorted(p for p in dataset_path.iterdir() if p.is_dir())
    if subdirs:
        # Structured by subdirectories
        for subdir in subdirs:
            image_paths = sorted(
                str(p) for p in subdir.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS
            )
            if image_paths:
                person_name = get_display_name(subdir.name)
                groups[person_name] = image_paths
    else:
        # Flat directory structure (e.g. images/)
        flat_groups = {}
        for img_path in sorted(dataset_path.iterdir()):
            if not img_path.is_file() or img_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            stem = img_path.stem
            # Strip trailing digits (e.g. sundar1 -> sundar, yan_lecun2 -> yan_lecun)
            person_key = re.sub(r"\d+$", "", stem).strip("_").lower()
            if not person_key:
                person_key = stem.lower()
            if person_key not in flat_groups:
                flat_groups[person_key] = []
            flat_groups[person_key].append(str(img_path))

        for person_key, image_paths in flat_groups.items():
            person_name = get_display_name(person_key)
            groups[person_name] = image_paths

    return groups


def main(dataset_dir: str = "images"):
    log_run_start("TEST ENROLLMENT RUN")
    dataset_path = Path(dataset_dir)
    if not dataset_path.is_dir():
        err_msg = f"Directory '{dataset_dir}' does not exist."
        log_message(err_msg)
        log_run_end(err_msg)
        raise SystemExit(err_msg)

    logger.info("Initializing EnrollmentService and VectorStore...")
    service = EnrollmentService()
    # Ensure Qdrant collection is created
    service.vector_store.create_collection()

    grouped_data = group_images_by_person(dataset_path)

    logger.info("Found %d person group(s) in '%s':", len(grouped_data), dataset_dir)
    log_message(f"Found {len(grouped_data)} person group(s) in '{dataset_dir}'")
    for person_name, paths in grouped_data.items():
        logger.info("  - %s (%d photo(s)): %s", person_name, len(paths), [Path(p).name for p in paths])

    print("\nStarting batch enrollment into Qdrant...\n")

    summary = []
    for person_name, paths in grouped_data.items():
        logger.info("Enrolling %s (%d photo(s))...", person_name, len(paths))
        res = service.enroll(image_paths=paths, person_name=person_name)
        summary.append((person_name, res))
        logger.info("Result for %s: %s\n", person_name, res)

    print("==========================================")
    print("BATCH ENROLLMENT COMPLETE")
    print("==========================================")
    total_enrolled = sum(r[1].get("enrolled_count", 0) for r in summary if isinstance(r[1], dict))
    done_msg = f"Batch enrollment complete. Total newly enrolled images: {total_enrolled}"
    print(done_msg)
    log_run_end(done_msg)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch-enroll face dataset from images directory into Qdrant.")
    parser.add_argument(
        "--dataset-dir",
        default="images",
        help="Path to folder containing dataset images or person subfolders (default: images)",
    )
    args = parser.parse_args()
    main(args.dataset_dir)
