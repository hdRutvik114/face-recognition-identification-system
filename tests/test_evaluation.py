import re
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from app.service.identification_service import IdentificationService
from app.logging_utils import log_run_start, log_message, log_run_end

def normalize_name(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())
# ---------------------------------------------------------
# Display name mapping
# ---------------------------------------------------------

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
    "rohit": "Rohit Sharma",
    "micheal": "Michael",
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

    # Unknown people
    "rutvik": "Rutvik",
    "nitish_singh": "Nitish Singh",
    "krish_naik": "Krish Naik",

    # Additional evaluation people
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

    # Additional unknown people
    "andy": "Andy Jassy",
    "yash": "Yash",
    "kiyan": "Kiyan Pillay",
    
}


# IMPORTANT:
# These names must exactly match the names returned by
# get_display_name().
#
# Only include people who are NOT enrolled in Qdrant.
UNKNOWN_PEOPLE = {
    "Alexandra Daddario",
    "Andrew",
    "Andy Jassy",
    "Brad Pitt",
    "Courteney Cox",
    "Emma Watson",
    "Girl",
    "Gordon Ramsay",
    "Gwen Stefani",
    "Joseph Gordon-Levitt",
    "Kiyan Pillay",
    "Krish Naik",
    "Nitish Singh",
    "Rutvik",
    "Ryan Gosling",
    "Sadie Sink",
    "Sheren",
    "Shisho",
    "Tom Cruise",
    "Yash",
    "Yuji Nishida",
     "Rayntwo",
    "Ryanthree",
}


# ---------------------------------------------------------
# Helper functions
# ---------------------------------------------------------

def get_display_name(person_key: str) -> str:
    key_lower = person_key.lower().strip()

    if key_lower in DISPLAY_NAME_OVERRIDES:
        return DISPLAY_NAME_OVERRIDES[key_lower]

    return re.sub(r"[_-]+", " ", person_key).strip().title()


def get_evaluation_items(evaluation_dir: Path):
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}

    items = []

    # -----------------------------------------------------
    # Case 1: Evaluation dataset contains person folders
    # -----------------------------------------------------

    subdirs = sorted(
        p for p in evaluation_dir.iterdir()
        if p.is_dir()
    )

    if subdirs:

        for subdir in subdirs:

            expected_name = get_display_name(subdir.name)

            for img_path in sorted(subdir.iterdir()):

                if (
                    img_path.is_file()
                    and img_path.suffix.lower() in IMAGE_EXTENSIONS
                ):
                    items.append(
                        (expected_name, img_path)
                    )

    # -----------------------------------------------------
    # Case 2: Evaluation dataset is flat
    # -----------------------------------------------------

    else:

        for img_path in sorted(evaluation_dir.iterdir()):

            if (
                not img_path.is_file()
                or img_path.suffix.lower() not in IMAGE_EXTENSIONS
            ):
                continue

            stem = img_path.stem

            # Example:
            # alakh4 -> alakh
            # yan_lecun5 -> yan_lecun
            # krish_naik -> krish_naik

            person_key = re.sub(
                r"\d+$",
                "",
                stem
            ).strip("_").lower()

            if not person_key:
                continue

            if person_key in [
                "building",
                "mulitple_ppl",
                "image",
            ]:
                continue

            expected_name = get_display_name(person_key)

            items.append(
                (expected_name, img_path)
            )

    return items


# ---------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------

def main():

    log_run_start("EVALUATION RUN")

    evaluation_dir = Path("data/evaluation")

    items = []

    # -----------------------------------------------------
    # Use data/evaluation
    # -----------------------------------------------------

    if (
        evaluation_dir.exists()
        and any(evaluation_dir.iterdir())
    ):

        print(
            f"Using evaluation directory: "
            f"'{evaluation_dir}'"
        )

        log_message(
            f"Using evaluation directory: "
            f"'{evaluation_dir}'"
        )

        items = get_evaluation_items(
            evaluation_dir
        )

    # -----------------------------------------------------
    # Fallback to images/
    # -----------------------------------------------------

    if not items:

        fallback_dir = Path("images")

        if (
            fallback_dir.exists()
            and any(fallback_dir.iterdir())
        ):

            print(
                "Note: 'data/evaluation' is empty. "
                "Evaluating enrolled images in "
                "'images/'..."
            )

            log_message(
                "Note: 'data/evaluation' is empty. "
                "Evaluating images in 'images/'..."
            )

            items = get_evaluation_items(
                fallback_dir
            )

    # -----------------------------------------------------
    # No images found
    # -----------------------------------------------------

    if not items:

        msg = (
            "No evaluation images found!\n"
            "Please place test images inside "
            "'data/evaluation/' structured as:\n"
            "  data/evaluation/person_name/image1.jpg\n"
            "  data/evaluation/person_name/image2.jpg"
        )

        print(msg)

        log_message(msg)

        log_run_end(
            "Evaluation completed with 0 test images."
        )

        return

    # -----------------------------------------------------
    # Create identification service
    # -----------------------------------------------------

    service = IdentificationService()

    print(
        f"\nStarting evaluation of "
        f"{len(items)} test image(s)...\n"
    )

    log_message(
        f"Starting evaluation of "
        f"{len(items)} test image(s)..."
    )

    # -----------------------------------------------------
    # Counters
    # -----------------------------------------------------

    total = 0

    # Genuine / known-person metrics
    genuine_attempts = 0
    correct = 0
    false_rejections = 0
    incorrect = 0

    # Unknown-person metrics
    unknown_attempts = 0
    correct_rejections = 0
    false_acceptances = 0

    # Errors
    errors = 0

    # -----------------------------------------------------
    # Table header
    # -----------------------------------------------------

    print(
        f"{'IMAGE':<25} | "
        f"{'EXPECTED':<18} | "
        f"{'PREDICTED':<18} | "
        f"{'SCORE':<7} | STATUS"
    )

    print("-" * 100)

    # -----------------------------------------------------
    # Evaluate each image
    # -----------------------------------------------------

    for expected_name, image_path in items:

        total += 1

        result = service.identify(
            str(image_path)
        )

        predicted = result.get(
            "person_name"
        )

        score = result.get(
            "score"
        )

        status = result.get(
            "status"
        )

        # Format score safely
        if isinstance(score, (float, int)):
            score_str = f"{score:.4f}"
        else:
            score_str = "N/A"

        # Format prediction
        pred_str = (
            predicted
            if predicted
            else (
                status
                if status
                else "None"
            )
        )

        # -------------------------------------------------
        # Determine whether this is a known or unknown
        # person.
        #
        # IMPORTANT:
        # expected_name comes from get_display_name()
        # and UNKNOWN_PEOPLE contains the same names.
        # -------------------------------------------------

        is_unknown_person = (
            expected_name in UNKNOWN_PEOPLE
        )

        # =================================================
        # UNKNOWN PERSON
        # =================================================

        if is_unknown_person:

            unknown_attempts += 1

            if status == "unknown":

                match_status = "CORRECT REJECTION"

                correct_rejections += 1

            elif status == "identified":

                match_status = "FALSE ACCEPT"

                false_acceptances += 1

            else:

                match_status = "ERROR"

                errors += 1

        # =================================================
        # GENUINE / ENROLLED PERSON
        # =================================================

        else:

            genuine_attempts += 1

            if (
                status == "identified"
                and  normalize_name(predicted) == normalize_name(expected_name)
            ):

                match_status = "CORRECT"

                correct += 1

            elif status == "unknown":

                match_status = "FALSE REJECTION"

                false_rejections += 1

            elif status == "identified":

                match_status = "MISMATCH"

                incorrect += 1

            else:

                match_status = "ERROR"

                errors += 1

        # -------------------------------------------------
        # Print result
        # -------------------------------------------------

        line = (
            f"{image_path.name:<25} | "
            f"{expected_name:<18} | "
            f"{pred_str:<18} | "
            f"{score_str:<7} | "
            f"{match_status}"
        )

        print(line)

        log_message(line)

    # -----------------------------------------------------
    # Calculate metrics
    # -----------------------------------------------------

    # FRR:
    # Genuine people incorrectly rejected as unknown.
    frr = (
        false_rejections
        / genuine_attempts
        * 100
        if genuine_attempts > 0
        else 0.0
    )

    # FAR:
    # Unknown people incorrectly accepted
    # as enrolled people.
    far = (
        false_acceptances
        / unknown_attempts
        * 100
        if unknown_attempts > 0
        else 0.0
    )

    # Accuracy among genuine/enrolled people.
    known_person_accuracy = (
        correct
        / genuine_attempts
        * 100
        if genuine_attempts > 0
        else 0.0
    )

    # Correct rejection rate for unknown people.
    unknown_rejection_rate = (
        correct_rejections
        / unknown_attempts
        * 100
        if unknown_attempts > 0
        else 0.0
    )

    # -----------------------------------------------------
    # Final summary
    # -----------------------------------------------------

    print("-" * 100)

    print(
        f"Genuine attempts:        {genuine_attempts}"
    )

    print(
        f"Correct identifications: {correct}"
    )

    print(
        f"False rejections:        {false_rejections}"
    )

    print(
        f"Mismatches:              {incorrect}"
    )

    print(
        f"Known-person accuracy:   "
        f"{known_person_accuracy:.2f}%"
    )

    print(
        f"FRR:                     "
        f"{frr:.2f}%"
    )

    print()

    print(
        f"Unknown attempts:        {unknown_attempts}"
    )

    print(
        f"Correct rejections:      {correct_rejections}"
    )

    print(
        f"False acceptances:       {false_acceptances}"
    )

    print(
        f"Unknown rejection rate:  "
        f"{unknown_rejection_rate:.2f}%"
    )

    print(
        f"FAR:                     "
        f"{far:.2f}%"
    )

    print()

    print(
        f"Errors:                  {errors}"
    )

    print("-" * 100)

    summary = (
        f"EVALUATION COMPLETE: "
        f"Total={total}, "
        f"Genuine={genuine_attempts}, "
        f"Unknown={unknown_attempts}, "
        f"Correct={correct}, "
        f"Mismatch={incorrect}, "
        f"Errors={errors}, "
        f"FRR={frr:.2f}%, "
        f"FAR={far:.2f}%, "
        f"KnownAccuracy={known_person_accuracy:.2f}%"
    )

    print(summary)

    print("=" * 100)

    log_run_end(summary)


if __name__ == "__main__":
    main()