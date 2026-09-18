import cv2
from insightface.app import FaceAnalysis


app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=-1, det_size=(640, 640))


image = cv2.imread("image.jpeg")
# This one takes teh image 
faces = app.get(image)

print(f"Number of faces detected: {len(faces)}")

for face in faces:
    print("Bounding box:", face.bbox)
    print("Confidence:", face.det_score)
    print("Landmarks:", face.kps)
   
    print("Embedding shape:", face.embedding.shape)
    print("First 5 values:", face.embedding[:5])