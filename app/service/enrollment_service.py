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
        # --------------------------------------------------
        # Identity is resolved ONCE, from the name, before we
        # look at a single pixel. It is never re-derived per image
        # and never influenced by embedding similarity.
        # --------------------------------------------------
        person_id = self.resolve_person_id(person_name)
        enrolled_count = 0

        for image_path in image_paths:

            # --------------------------------------------------
            # 0. Refuse anything outside data/enrolled/
            # --------------------------------------------------
            self._assert_path_is_enrollable(image_path)

            image = cv2.imread(image_path)

            faces = self.face_app.get(image)

            # No face
            if len(faces) == 0:
                msg = f"No face detected in {image_path}"
                print(msg)
                log_message(msg)
                continue

            # Multiple faces
            if len(faces) > 1:
                msg = f"Multiple faces detected in {image_path}"
                print(msg)
                log_message(msg)
                continue

            face = faces[0]
            embedding = face.embedding

            # --------------------------------------------------
            # 1. Check if the exact same image was already enrolled
            # --------------------------------------------------
            image_id = self.get_image_id(image_path)

            if self.vector_store.image_exists(image_id):
                msg = f"Image {image_path} already exists. Skipping."
                print(msg)
                log_message(msg)
                continue

            # --------------------------------------------------
            # 2. Ask Qdrant (source of truth) how many images this
            #    person already has, right before every insert.
            # --------------------------------------------------
            image_count = self.vector_store.count_person_images(person_id)
            if image_count >= 3:
                msg = f"{person_name} already has {image_count} images in Qdrant. Skipping."
                print(msg)
                log_message(msg)
                continue

            # --------------------------------------------------
            # 3. Store the new face embedding
            #    (vector_store.add_embedding must call
            #    upsert(..., wait=True) internally)
            # --------------------------------------------------
            self.vector_store.add_embedding(
                embedding=embedding,
                person_id=person_id,
                person_name=person_name,
                image_id=image_id
            )

            enrolled_count += 1
            log_message(f"Enrolled image '{image_path}' for {person_name} (ID: {person_id})")

        # ------------------------------------------------------
        # 4. Nothing was enrolled
        # ------------------------------------------------------
        if enrolled_count == 0:
            res = {
                "person_id": person_id,
                "person_name": person_name,
                "enrolled_count": 0,
                "message": "No new images were enrolled."
            }
            log_message(f"Enrollment result for {person_name}: {res}")
            return res

        # ------------------------------------------------------
        # 5. Enrollment successful
        # ------------------------------------------------------
        res = {
            "person_id": person_id,
            "person_name": person_name,
            "enrolled_count": enrolled_count,
            "message": "Enrollment completed."
        }
        log_message(f"Enrollment result for {person_name}: {res}")
        return res

    def get_image_id(self, image_path):
        with open(image_path, "rb") as file:
            image_bytes = file.read()

        return hashlib.sha256(image_bytes).hexdigest()