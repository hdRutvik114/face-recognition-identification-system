import re
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.service.enrollment_service import EnrollmentService
from app.logging_utils import log_run_start, log_message, log_run_end

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
    "alakh": "Alakh Pandey",
    "amit": "Amit",
    "arvind": "Arvind Srinivas",
    "cristino": "Cristiano Ronaldo",
    "donald": "Donald Trump",
    "gandhi": "Mahatma Gandhi",
    "jeffbezos": "Jeff Bezos",
    "modi": "Narendra Modi",
    "mrbeast": "MrBeast",
    "naryanmurthy": "Narayana Murthy",
    "parth": "Parth",
    "piyush": "Piyush Bansal",
    "putin": "Vladimir Putin",
    "sardha": "Shraddha Khapra",
    "sharukh": "Shah Rukh Khan",
    "thor": "Thor",
    "tony": "Tony Stark",
    "rutvik": "Rutvik",
    "nitish_singh": "Nitish Singh",
    "krish_naik": "Krish Naik",
    "alexandra": "Alexandra Daddario",
    "andrew": "Andrew",
    "bradpit": "Brad Pitt",
    "cox": "Courteney Cox",
    "emma": "Emma Watson",
    "girl": "Girl",
    "gordan": "Gordon Ramsay",
    "joseph": "Joseph Gordon-Levitt",
    "nishida": "Yuji Nishida",
    "ryan": "Ryan Gosling",
    "sheren": "Sheren",
    "shisho": "Shisho",
    "sink": "Sadie Sink",
    "stefani": "Gwen Stefani",
    "tom": "Tom Cruise",
}


def get_display_name(person_key: str) -> str:
    key_lower = person_key.lower().strip()
    if key_lower in DISPLAY_NAME_OVERRIDES:
        return DISPLAY_NAME_OVERRIDES[key_lower]
    return re.sub(r"[_-]+", " ", person_key).strip().title()


def get_dataset_dir() -> Path:
    # Check images directory first for flat dataset
    images_dir = Path("images")
    if images_dir.exists() and any(images_dir.iterdir()):
        return images_dir
    enrolled_dir = Path("data/enrolled")
    if enrolled_dir.exists() and any(enrolled_dir.iterdir()):
        return enrolled_dir
    return images_dir


def group_images_by_person(dataset_path: Path) -> dict[str, list[str]]:
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
    groups = {}

    subdirs = sorted(p for p in dataset_path.iterdir() if p.is_dir())
    if subdirs:
        for subdir in subdirs:
            image_paths = sorted(
                str(p) for p in subdir.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS
            )
            if image_paths:
                person_name = get_display_name(subdir.name)
                groups[person_name] = image_paths
    else:
        flat_groups = {}
        for img_path in sorted(dataset_path.iterdir()):
            if not img_path.is_file() or img_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            stem = img_path.stem
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


def main():
    log_run_start("DATASET ENROLLMENT RUN")
    dataset_dir = get_dataset_dir()
    msg = f"Using dataset directory: '{dataset_dir}'"
    print(msg)
    log_message(msg)

    if not dataset_dir.exists() or not any(dataset_dir.iterdir()):
        warn = f"No images or subfolders found in '{dataset_dir}'."
        print(warn)
        log_message(warn)
        log_run_end("Completed with 0 images.")
        return

    enrollment_service = EnrollmentService()
    enrollment_service.vector_store.create_collection()

    grouped_data = group_images_by_person(dataset_dir)
    msg_groups = f"Found {len(grouped_data)} person identity group(s) to process."
    print(f"{msg_groups}\n")
    log_message(msg_groups)

    total_enrolled = 0
    for person_name, image_paths in grouped_data.items():
        print(f"--- Enrolling {person_name} ({len(image_paths)} image(s)) ---")
        result = enrollment_service.enroll(
            image_paths=image_paths,
            person_name=person_name
        )
        print(f"Result: {result}\n")
        total_enrolled += result.get("enrolled_count", 0)

    done_msg = f"Batch enrollment completed. Total newly enrolled images: {total_enrolled}."
    print(done_msg)
    log_run_end(done_msg)


if __name__ == "__main__":
    main()