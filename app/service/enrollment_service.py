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
        Deterministically map a person's name to a "claimed" person_id.

        This is a pure function of the name only - it never looks at
        embeddings or Qdrant, and the same name always produces the same
        id on every run.

        IMPORTANT: as of this fix, this is NOT used as the actual storage
        identity for a new face. It is only a comparison point: enroll()
        checks face-embedding evidence against it to decide whether the
        entered name genuinely refers to the same face, a different
        already-enrolled face, or a brand-new one. The real identity of
        each enrolled image is decided by face matching in enroll(), below.
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
        # The identity the entered name CLAIMS to refer to. Used only as a
        # comparison point below - never assumed correct on its own, and
        # never used directly as a new face's storage id unless there's no
        # collision to worry about.
        claimed_person_id = self.resolve_person_id(person_name)

        enrolled_count = 0
        skipped_count = 0
        rejected_count = 0

        details = []

        # Resolved from face evidence, once per request, then held fixed
        # for every remaining image in this same request.
        target_person_id = None
        target_is_new = False

        # ------------------------------------------------------------------
        # Phase 1: validate every image and resolve/verify face identity
        # against the EXISTING Qdrant database only. Nothing is written to
        # Qdrant in this phase, so no image is ever compared against
        # another not-yet-inserted image from this same request.
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

            # Check duplicate image (unchanged)
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

            # ---- Face-identity resolution / verification against EXISTING
            # Qdrant data. Pure embedding similarity - name is only used to
            # interpret the result, never to decide it.
            best_match = self.vector_store.find_best_match(embedding)

            if best_match is not None and best_match.score >= ENROLLMENT_DUPLICATE_THRESHOLD:
                matched_person_id = best_match.payload["person_id"]
                matched_person_name = best_match.payload["person_name"]

                if target_person_id is None:
                    if matched_person_id == claimed_person_id:
                        # Face matches the person this name refers to - confirmed.
                        target_person_id = claimed_person_id
                        target_is_new = False
                    else:
                        # Same face already enrolled under a DIFFERENT name.
                        msg = (
                            f"Face in {image_path} matches an already-enrolled "
                            f"person ('{matched_person_name}', "
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
                            "matched_person_name": matched_person_name,
                            "similarity": best_match.score
                        })
                        continue

                elif matched_person_id == target_person_id:
                    pass  # consistent with what this request has already established

                else:
                    # This image's face matches a different already-enrolled
                    # person than what earlier images in this SAME request
                    # established. Reject just this image.
                    msg = (
                        f"Face in {image_path} matches '{matched_person_name}' "
                        f"(score={best_match.score:.4f}), which conflicts with "
                        f"the identity already confirmed earlier in this request."
                    )
                    print(msg)
                    log_message(msg)

                    rejected_count += 1
                    details.append({
                        "image": os.path.basename(image_path),
                        "status": "rejected",
                        "reason": "Face conflicts with the identity established earlier in this request",
                        "matched_person_name": matched_person_name,
                        "similarity": best_match.score
                    })
                    continue

            else:
                # No confident match against existing Qdrant data.
                if target_person_id is None:
                    if self.vector_store.count_person_images(claimed_person_id) > 0:
                        # The entered name already belongs to a different,
                        # existing face. This is a genuinely new identity -
                        # give it its own id so it does NOT inherit that
                        # person's 3-image cap.
                        target_person_id = str(uuid.uuid4())
                    else:
                        # Brand-new name and brand-new face: no collision to
                        # worry about, keep the simple deterministic id.
                        target_person_id = claimed_person_id
                    target_is_new = True

                elif target_is_new:
                    pass  # expected - nothing in Qdrant to match yet for a brand-new identity

                else:
                    # An identity was already confirmed (via a real Qdrant
                    # match) earlier in this request, but this image doesn't
                    # match it. Reject rather than silently trusting the name.
                    msg = (
                        f"Face in {image_path} does not match the identity "
                        f"confirmed earlier in this request for '{person_name}'."
                    )
                    print(msg)
                    log_message(msg)

                    rejected_count += 1
                    details.append({
                        "image": os.path.basename(image_path),
                        "status": "rejected",
                        "reason": "Face does not match the identity confirmed earlier in this request"
                    })
                    continue

            pending.append((image_path, embedding, image_id))

        # ------------------------------------------------------------------
        # Phase 2: enforce the max-3-images-per-identity rule and insert.
        # ------------------------------------------------------------------
        existing_count = (
            self.vector_store.count_person_images(target_person_id)
            if target_person_id is not None
            else 0
        )

        for image_path, embedding, image_id in pending:

            if existing_count >= 3:
                msg = (
                    f"Identity for '{person_name}' already has "
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
                person_id=target_person_id,
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
                f"for {person_name} (ID: {target_person_id})"
            )

        res = {
            "person_id": target_person_id,
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