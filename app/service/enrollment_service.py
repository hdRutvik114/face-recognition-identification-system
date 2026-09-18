from app.vectorstore.vector_store import VectorStore
from insightface.app import FaceAnalysis
import cv2


class EnrollmentService:

    def __init__(self):
        self.face_app = FaceAnalysis(name="buffalo_l")
        self.face_app.prepare(ctx_id=-1, det_size=(640, 640))

        self.vector_store = VectorStore()

    def enroll(self, image_path, person_name):

        image = cv2.imread(image_path)

        faces = self.face_app.get(image)

        if not faces:
            raise ValueError("No face detected.")

        face = faces[0]

        embedding = face.embedding

        self.vector_store.add_embedding(
            embedding=embedding,
            person_name=person_name
        )

        return {
            "person_name": person_name,
            "message": "Face enrolled successfully."
        }