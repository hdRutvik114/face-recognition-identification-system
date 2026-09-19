import hashlib
import uuid

from app.vectorstore.vector_store import VectorStore
from insightface.app import FaceAnalysis
import cv2
import os


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
                print(f"No face detected in {image_path}")
                continue
    
            # Multiple faces
            if len(faces) > 1:
                print(f"Multiple faces detected in {image_path}")
                continue
    
            face = faces[0]
            embedding = face.embedding
    
            # --------------------------------------------------
            # 1. Check if the exact same image was already enrolled
            # --------------------------------------------------
            image_id = self.get_image_id(image_path)
    
            if self.vector_store.image_exists(image_id):
                print(f"Image {image_path} already exists. Skipping.")
                continue
    
            # --------------------------------------------------
            # 2. Check if this face belongs to an existing person
            # --------------------------------------------------
            best_match = self.vector_store.find_best_match(embedding)
    
            if best_match is not None and best_match.score >= 0.70:
    
                # Existing person
                person_id = best_match.payload["person_id"]
                existing_person_name = best_match.payload["person_name"]
    
                # Count existing images
                image_count = self.vector_store.count_person_images(person_id)
    
                # Maximum 3 images per person
                if image_count >= 3:
                    print(
                        f"{existing_person_name} already has "
                        f"{image_count} images. Skipping."
                    )
                    continue
    
                # Keep the original name stored for this person
                person_name = existing_person_name
    
            else:
    
                # No matching person found
                # Create a new identity
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
            #here the images completion happens 
    
        # ------------------------------------------------------
        # 4. Nothing was enrolled
        # ------------------------------------------------------
        if enrolled_count == 0:
            return {
                "person_id": None,
                "person_name": person_name,
                "enrolled_count": 0,
                "message": "No new images were enrolled."
            }
    
        # ------------------------------------------------------
        # 5. Enrollment successful
        # ------------------------------------------------------
        return {
            "person_id": person_id,
            "person_name": person_name,
            "enrolled_count": enrolled_count,
            "message": "Enrollment completed."
        }
    def get_image_id(self, image_path):
        with open(image_path, "rb") as file:
            image_bytes = file.read()

        return hashlib.sha256(image_bytes).hexdigest()