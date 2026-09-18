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

        enrolled_count = 0
    
        for image_path in image_paths:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found: {image_path}")
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"cv2.imread failed to read: {image_path}")
            faces = self.face_app.get(img)
    
            if not faces:
                print(f"No face detected in {image_path}")
                continue
    
            face = faces[0]
    
            embedding = face.embedding
    
            self.vector_store.add_embedding(
                embedding=embedding,
                person_name=person_name
            )
    
            enrolled_count += 1
    
        return {
            "person_name": person_name,
            "enrolled_count": enrolled_count,
            "message": "Enrollment completed."
        }