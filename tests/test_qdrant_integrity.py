import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.vectorstore.vector_store import VectorStore


def inspect_qdrant_integrity():
    """Scrolls Qdrant points, checks person image counts, and verifies person_id consistency."""
    store = VectorStore()
    res = store.client.scroll(collection_name="face_embeddings", limit=300)
    points = res[0]

    people_data = {}

    for p in points:
        if not p.payload:
            continue
        person_name = p.payload.get("person_name", "Unknown")
        person_id = p.payload.get("person_id")
        image_id = p.payload.get("image_id")

        if person_name not in people_data:
            people_data[person_name] = {
                "person_ids": set(),
                "points": [],
            }

        if person_id:
            people_data[person_name]["person_ids"].add(person_id)
        people_data[person_name]["points"].append((p.id, image_id))

    return people_data


def print_integrity_report(people_data):
    """Prints a formatted report of enrolled people, image counts, and person_id consistency."""
    print("\n" + "=" * 105)
    print("QDRANT INTEGRITY & PERSON ID CONSISTENCY REPORT")
    print("=" * 105)
    print(f"{'PERSON NAME':<25} | {'COUNT':<7} | {'UNIQUE IDs':<10} | {'PERSON ID':<38} | STATUS")
    print("-" * 105)

    people_with_3_images = []
    inconsistent_people = []

    for person_name, data in sorted(people_data.items()):
        count = len(data["points"])
        person_ids = data["person_ids"]
        num_unique_ids = len(person_ids)

        if num_unique_ids == 1:
            pid_str = list(person_ids)[0]
            if count == 3:
                status = "VALID (3 images)"
                people_with_3_images.append(person_name)
            else:
                status = f"VALID ({count} images)"
        elif num_unique_ids == 0:
            pid_str = "MISSING"
            status = "ERROR (No person_id)"
            inconsistent_people.append(person_name)
        else:
            pid_str = f"MULTIPLE ({num_unique_ids} IDs)"
            status = "ERROR (Inconsistent person_ids)"
            inconsistent_people.append(person_name)

        print(f"{person_name:<25} | {count:<7} | {num_unique_ids:<10} | {pid_str:<38} | {status}")

    print("-" * 105)
    print(f"Total Enrolled Identities:    {len(people_data)}")
    print(f"Identities with 3 Images:     {len(people_with_3_images)}")
    print(f"Identities with Consistent ID: {len(people_data) - len(inconsistent_people)} / {len(people_data)}")
    print("=" * 105 + "\n")

    return people_with_3_images, inconsistent_people


def test_qdrant_person_ids_are_consistent():
    """Test assertion that every enrolled person has exactly one unique person_id in Qdrant."""
    people_data = inspect_qdrant_integrity()
    inconsistent = []
    for person_name, data in people_data.items():
        if len(data["person_ids"]) != 1:
            inconsistent.append((person_name, data["person_ids"]))

    assert len(inconsistent) == 0, f"Found inconsistent person_ids for: {inconsistent}"


def test_qdrant_image_counts_do_not_exceed_3():
    """Test assertion that no enrolled person has more than 3 images in Qdrant."""
    people_data = inspect_qdrant_integrity()
    over_limit = []
    for person_name, data in people_data.items():
        if len(data["points"]) > 3:
            over_limit.append((person_name, len(data["points"])))

    assert len(over_limit) == 0, f"Found people exceeding 3 images: {over_limit}"


if __name__ == "__main__":
    people_data = inspect_qdrant_integrity()
    print_integrity_report(people_data)
