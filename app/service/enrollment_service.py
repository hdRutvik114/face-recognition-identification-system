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

        person_id = str(uuid.uuid4())
        enrolled_count = 0
    
        for image_path in image_paths:
    
            image = cv2.imread(image_path)
    
            faces = self.face_app.get(image)

            if len(faces) == 0:
                print(f"No face detected in {image_path}")
                continue
            if len(faces) > 1:
                print(f"Multiple faces detected in {image_path}")
                continue

            #Here we are creating a face detection model 
            # if the image has more then the 2 images then there is problem in applying the diff person name and personid so here wee check that 1 face or 2 face 
            face = faces[0]
    
            embedding = face.embedding
    
            image_id = self.get_image_id(image_path)
            if self.vector_store.image_exists(image_id):
                print(f"Image {image_path} already exists  bro.")
                return {
                    "person_id": person_id,
                    "person_name": person_name,
                    "enrolled_count": enrolled_count,
                    "message": f"same exact {image_path} already exists."
                }   
    
            self.vector_store.add_embedding(
                embedding=embedding,
                      person_id=person_id,
                person_name=person_name,
              image_id=image_id
            )
    
            enrolled_count += 1
    
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