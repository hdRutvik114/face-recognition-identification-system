import re
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.service.identification_service import IdentificationService
from app.logging_utils import log_run_start, log_message, log_run_end

DISPLAY_NAME_OVERRIDES = {
    "sundar": "Sundar Pichai",
    "sundar_pichai": "Sundar Pichai",
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
}


def get_display_name(person_key: str) -> str:
    key_lower = person_key.lower().strip()
    if key_lower in DISPLAY_NAME_OVERRIDES:
        return DISPLAY_NAME_OVERRIDES[key_lower]
    return re.sub(r"[_-]+", " ", person_key).strip().title()


def get_evaluation_items(evaluation_dir: Path):
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
    items = []

    subdirs = sorted(p for p in evaluation_dir.iterdir() if p.is_dir())
    if subdirs:
        for subdir in subdirs:
            expected_name = get_display_name(subdir.name)
            for img_path in sorted(subdir.iterdir()):
                if img_path.is_file() and img_path.suffix.lower() in IMAGE_EXTENSIONS:
                    items.append((expected_name, img_path))
    else:
        # Check flat files in dataset directory (e.g. images/)
        for img_path in sorted(evaluation_dir.iterdir()):
            if not img_path.is_file() or img_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            stem = img_path.stem
            person_key = re.sub(r"\d+$", "", stem).strip("_").lower()
            if not person_key or person_key in ["building", "mulitple_ppl", "image"]:
                continue
            expected_name = get_display_name(person_key)
            items.append((expected_name, img_path))

    return items


def main():
    log_run_start("EVALUATION RUN")
    evaluation_dir = Path("data/evaluation")

    # If data/evaluation is empty, check fallback to images/
    items = []
    if evaluation_dir.exists() and any(evaluation_dir.iterdir()):
        print(f"Using evaluation directory: '{evaluation_dir}'")
        log_message(f"Using evaluation directory: '{evaluation_dir}'")
        items = get_evaluation_items(evaluation_dir)

    if not items:
        fallback_dir = Path("images")
        if fallback_dir.exists() and any(fallback_dir.iterdir()):
            print(f"Note: 'data/evaluation' is empty. Evaluating enrolled images in '{fallback_dir}'...")
            log_message(f"Note: 'data/evaluation' is empty. Evaluating images in '{fallback_dir}'...")
            items = get_evaluation_items(fallback_dir)

    if not items:
        msg = (
            "No evaluation images found!\n"
            "Please place test images inside 'data/evaluation/' structured as:\n"
            "  data/evaluation/person_name/image1.jpg\n"
            "  data/evaluation/person_name/image2.jpg"
        )
        print(msg)
        log_message(msg)
        log_run_end("Evaluation completed with 0 test images.")
        return

    service = IdentificationService()
    print(f"\nStarting evaluation of {len(items)} test image(s)...\n")
    log_message(f"Starting evaluation of {len(items)} test image(s)...")

    total = 0
    correct = 0
    unknowns = 0
    incorrect = 0

    print(f"{'IMAGE':<25} | {'EXPECTED':<18} | {'PREDICTED':<18} | {'SCORE':<7} | STATUS")
    print("-" * 80)

    for expected_name, image_path in items:
        total += 1
        result = service.identify(str(image_path))
        predicted = result.get("person_name")
        score = result.get("score")
        status = result.get("status")

        score_str = f"{score:.4f}" if isinstance(score, float) else "N/A"
        pred_str = predicted if predicted else (status if status else "None")

        if status == "identified" and predicted == expected_name:
            match_status = "CORRECT"
            correct += 1
        elif status == "unknown":
            match_status = "UNKNOWN"
            unknowns += 1
        elif status == "error":
            match_status = f"ERROR ({result.get('message')})"
            unknowns += 1
        else:
            match_status = "MISMATCH"
            incorrect += 1

        line = f"{image_path.name:<25} | {expected_name:<18} | {pred_str:<18} | {score_str:<7} | {match_status}"
        print(line)
        log_message(line)

    accuracy = (correct / total * 100) if total > 0 else 0.0

    print("-" * 80)
    summary = f"EVALUATION COMPLETE: Total={total}, Correct={correct}, Unknown={unknowns}, Mismatch={incorrect}, Accuracy={accuracy:.2f}%"
    print(summary)
    print("=" * 80)
    log_run_end(summary)


if __name__ == "__main__":
    main()