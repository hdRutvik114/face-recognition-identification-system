import cv2

from insightface.app import FaceAnalysis

from app.vectorstore.vector_store import VectorStore


face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=-1, det_size=(640, 640))


image = cv2.imread("images\ilyasutskiver2.jpg")
faces = face_app.get(image)

if not faces:
    raise ValueError("No face found.")

embedding = faces[0].embedding


store = VectorStore()

results = store.search(embedding)

for result in results:
    print("Person:", result.payload["person_name"])
    print("Score:", result.score)