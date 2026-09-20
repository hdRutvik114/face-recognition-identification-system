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
        person_id = self.resolve_person_id(person_name)
    
        enrolled_count = 0
        skipped_count = 0
        rejected_count = 0
    
        details = []
    
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
    
            # Check duplicate image
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
    
            # Check person's current image count
            image_count = self.vector_store.count_person_images(person_id)
    
            if image_count >= 3:
                msg = (
                    f"{person_name} already has "
                    f"{image_count} images in Qdrant. Skipping."
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
    
            # Store embedding
            self.vector_store.add_embedding(
                embedding=embedding,
                person_id=person_id,
                person_name=person_name,
                image_id=image_id
            )
    
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