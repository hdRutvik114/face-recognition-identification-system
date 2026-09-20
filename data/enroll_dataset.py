from pathlib import Path

from app.service.enrollment_service import EnrollmentService


DATASET_DIR = Path("data/enrolled")


def main():
    enrollment_service = EnrollmentService()

    for person_dir in DATASET_DIR.iterdir():

        if not person_dir.is_dir():
            continue

        person_name = person_dir.name.replace("_", " ").title()

        image_paths = [
            str(path)
            for path in person_dir.iterdir()
            if path.suffix.lower() in [".jpg", ".jpeg", ".png"]
        ]

        if not image_paths:
            continue

        print(f"\nEnrolling: {person_name}")

        result = enrollment_service.enroll(
            image_paths=image_paths,
            person_name=person_name
        )

        print(result)


if __name__ == "__main__":
    main()