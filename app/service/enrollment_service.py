import hashlib
import uuid
import os
import cv2
from insightface.app import FaceAnalysis

from app.vectorstore.vector_store import VectorStore
from app.logging_utils import log_message

# Fixed namespace so that uuid5(NAMESPACE, name) is stable across
# process restarts and across runs. Do not change this value once
# you have enrolled data, or every person_id will change.
PERSON_ID_NAMESPACE = uuid.UUID("6f6f9f2a-5a1b-4b3a-9c1e-2a2f8b7e0d11")

# Separate from the /identify threshold (0.65) on purpose - these answer
# different questions ("is this a confident enough match to accept?" vs
# "is this face already in the system at all?") and are tuned independently.
ENROLLMENT_DUPLICATE_THRESHOLD = 0.70


class EnrollmentService:

    # Any path with one of these directory names as a component is refused.
    # This is a blocklist rather than a single fixed root because enrollment
    # data may legitimately live under different layouts (images/ flat mode,
    # data/enrolled/ folder mode, etc.) but must never live under any of these.
    FORBIDDEN_PATH_SEGMENTS = {"evaluation", "eval", "test"}

    def __init__(self):
        self.face_app = FaceAnalysis(name="buffalo_l")
        self.face_app.prepare(ctx_id=-1, det_size=(640, 640))

        self.vector_store = VectorStore()

    def resolve_person_id(self, person_name):
        """
        Deterministically map a person's name to a person_id.

        This is a pure function of the name only — it never looks at
        embeddings or Qdrant. The same folder/name always produces the
        same person_id, on this run and on every future run.

        NOTE: this id is used to label a person's own gallery and to
        answer "is this match the same person I claim to be enrolling?".
        It is NOT used to decide whether a face is already enrolled -
        that decision is made purely from face-embedding similarity in
        enroll() below.
        """
        normalized_name = person_name.strip().lower()
        return str(uuid.uuid5(PERSON_ID_NAMESPACE, normalized_name))

    def _assert_path_is_enrollable(self, image_path):
        real_path = os.path.realpath(image_path)
        path_segments = {part.lower() for part in real_path.split(os.sep)}

        forbidden_hit = path_segments & self.FORBIDDEN_PATH_SEGMENTS
        if forbidden_hit:
            raise ValueError(
                f"Refusing to enroll '{image_path}': its path contains "
                f"the forbidden segment {forbidden_hit}. This guard exists "
                f"specifically to prevent evaluation images from being "
                f"written to Qdrant."
            )

    def enroll(self, image_paths, person_name):
        person_id = self.resolve_person_id(person_name)

        enrolled_count = 0
        skipped_count = 0
        rejected_count = 0

        details = []

        # ------------------------------------------------------------------
        # Phase 1: validate every image and check face-identity against the
        # EXISTING Qdrant database only. Nothing is written to Qdrant in
        # this phase. This is what guarantees image 2 in a 3-image request
        # is never compared against image 1 from the same request - there
        # is nothing in Qdrant yet for either of them to be compared to.
        # ------------------------------------------------------------------
        pending = []  # list of (image_path, embedding, image_id)

        for image_path in image_paths:

            self._assert_path_is_enrollable(image_path)

            image = cv2.imread(image_path)

            if image is None:
                msg = f"Could not read image: {image_path}"
                print(msg)
                log_message(msg)

                rejected_count += 1
                details.append({
                    "image": os.path.basename(image_path),
                    "status": "rejected",
                    "reason": "Could not read image"
                })
                continue

            faces = self.face_app.get(image)

            # No face
            if len(faces) == 0:
                msg = f"No face detected in {image_path}"
                print(msg)
                log_message(msg)

                rejected_count += 1
                details.append({
                    "image": os.path.basename(image_path),
                    "status": "rejected",
                    "reason": "No face detected"
                })
                continue

            # Multiple faces
            if len(faces) > 1:
                msg = f"Multiple faces detected in {image_path}"
                print(msg)
                log_message(msg)

                rejected_count += 1
                details.append({
                    "image": os.path.basename(image_path),
                    "status": "rejected",
                    "reason": "Multiple faces detected"
                })
                continue

            face = faces[0]
            embedding = face.embedding

            # Check duplicate image (unchanged - catches re-uploading the
            # exact same file bytes)
            image_id = self.get_image_id(image_path)

            if self.vector_store.image_exists(image_id):
                msg = f"Image {image_path} already exists. Skipping."
                print(msg)
                log_message(msg)

                skipped_count += 1
                details.append({
                    "image": os.path.basename(image_path),
                    "status": "skipped",
                    "reason": "Image already exists"
                })
                continue

            # ---- NEW: face-identity duplicate check against EXISTING
            # Qdrant data. This is the check that was missing. It is pure
            # embedding similarity - the entered name plays no role in
            # deciding whether a matching face exists.
            best_match = self.vector_store.find_best_match(embedding)

            if best_match is not None and best_match.score >= ENROLLMENT_DUPLICATE_THRESHOLD:
                matched_person_id = best_match.payload["person_id"]

                if matched_person_id != person_id:
                    # Same face, different declared name -> this is the bug case, block it.
                    msg = (
                        f"Face in {image_path} matches an already-enrolled "
                        f"person ('{best_match.payload['person_name']}', "
                        f"score={best_match.score:.4f}) but was submitted "
                        f"under a different name ('{person_name}')."
                    )
                    print(msg)
                    log_message(msg)

                    rejected_count += 1
                    details.append({
                        "image": os.path.basename(image_path),
                        "status": "rejected",
                        "reason": "Face already enrolled under a different name",
                        "matched_person_name": best_match.payload["person_name"],
                        "similarity": best_match.score
                    })
                    continue

                # else: same person re-submitting another photo of
                # themselves under their correct name - fall through to
                # the normal flow, still subject to the max-3-images rule.

            pending.append((image_path, embedding, image_id))

        # ------------------------------------------------------------------
        # Phase 2: enforce the max-3-images-per-person rule and insert.
        # Only reached after every image has been validated above, so the
        # count check below reflects a stable starting point plus whatever
        # this call has actually committed so far.
        # ------------------------------------------------------------------
        existing_count = self.vector_store.count_person_images(person_id)

        for image_path, embedding, image_id in pending:

            if existing_count >= 3:
                msg = (
                    f"{person_name} already has "
                    f"{existing_count} images in Qdrant. Skipping."
                )
                print(msg)
                log_message(msg)

                skipped_count += 1
                details.append({
                    "image": os.path.basename(image_path),
                    "status": "skipped",
                    "reason": "Maximum 3 images already enrolled"
                })
                continue

            self.vector_store.add_embedding(
                embedding=embedding,
                person_id=person_id,
                person_name=person_name,
                image_id=image_id
            )

            existing_count += 1
            enrolled_count += 1

            details.append({
                "image": os.path.basename(image_path),
                "status": "enrolled",
                "reason": "Successfully enrolled"
            })

            log_message(
                f"Enrolled image '{image_path}' "
                f"for {person_name} (ID: {person_id})"
            )

        res = {
            "person_id": person_id,
            "person_name": person_name,
            "enrolled_count": enrolled_count,
            "skipped_count": skipped_count,
            "rejected_count": rejected_count,
            "details": details,
            "message": "Enrollment completed."
        }

        log_message(
            f"Enrollment result for {person_name}: {res}"
        )

        return res

    def get_image_id(self, image_path):
        with open(image_path, "rb") as file:
            image_bytes = file.read()

        return hashlib.sha256(image_bytes).hexdigest()