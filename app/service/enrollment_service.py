import hashlib
import uuid
import os
import cv2
from insightface.app import FaceAnalysis

from app.vectorstore.vector_store import VectorStore
from app.logging_utils import log_message


class EnrollmentService:

    def __init__(self):
        self.face_app = FaceAnalysis(name="buffalo_l")
        self.face_app.prepare(ctx_id=-1, det_size=(640, 640))

        self.vector_store = VectorStore()

    def enroll(self, image_paths, person_name):
        person_id = None
        enrolled_count = 0
    
        for image_path in image_paths:
    
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
            # 2. Check if this face belongs to an existing person
            # --------------------------------------------------
            best_match = self.vector_store.find_best_person_match(embedding)
    
            if best_match is not None and best_match["score"] >= 0.70:
    
                # Existing person
                person_id = best_match["person_id"]
                existing_person_name = best_match["person_name"]
    
                # Count existing images
                image_count = self.vector_store.count_person_images(person_id)
    
                # Maximum 3 images per person
                if image_count >= 3:
                    msg = f"{existing_person_name} already has {image_count} images. Skipping."
                    print(msg)
                    log_message(msg)
                    continue
    
                # Keep the original name stored for this person
                person_name = existing_person_name
    
            else:
    
                # No matching person found
                # Create a new identity if not already created in this batch
                if person_id is None:
                    person_id = str(uuid.uuid4())
    
            # --------------------------------------------------
            # 3. Store the new face embedding
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
                "person_id": None,
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