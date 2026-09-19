from insightface.app import FaceAnalysis
import cv2

from app.vectorstore.vector_store import VectorStore


class IdentificationService:

    def __init__(self):
        self.face_app = FaceAnalysis(name="buffalo_l")
        self.face_app.prepare(ctx_id=-1, det_size=(640, 640))

        self.vector_store = VectorStore()

        # Temporary threshold.
        # We will calibrate this properly during evaluation.
        self.threshold = 0.70

    def identify(self, image_path):

        image = cv2.imread(image_path)

        # Image could not be read
        if image is None:
            return {
                "status": "error",
                "message": "Could not read image."
            }

        faces = self.face_app.get(image)

        # No face
        if len(faces) == 0:
            return {
                "status": "error",
                "message": "No face detected."
            }

        # More than one face
        if len(faces) > 1:
            return {
                "status": "error",
                "message": "Multiple faces detected."
            }

        # Get the single face embedding
        embedding = faces[0].embedding

        # Search Qdrant
        best_match = self.vector_store.find_best_person_match(embedding)
        # Here now instead of best match we do best person match 
        # Database is empty
        if best_match is None:
            return {
            "status": "unknown",
             "message": "No enrolled faces found."
          }

        score = best_match["score"]
        
        print(f"Best person similarity score: {score:.4f}")
        
        if score < self.threshold:
            return {
                "status": "unknown",
                "person_id": None,
                "person_name": None,
                "score": score,
                "message": "Unknown person."
            }
        
        return {
            "status": "identified",
            "person_id": best_match["person_id"],
            "person_name": best_match["person_name"],
            "score": score,
            "message": "Person identified successfully."
        }