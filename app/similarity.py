import cv2
import numpy as np
from insightface.app import FaceAnalysis


app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=-1, det_size=(640, 640))


def get_embedding(image_path):
    image = cv2.imread(image_path)
    faces = app.get(image)

    if not faces:
        raise ValueError(f"No face found in {image_path}")

    return faces[0].embedding


embedding_a = get_embedding("test1.jpeg")
embedding_b = get_embedding("test2.jpeg")

#here we normalize the vectors in multidimensional space
embedding_a = embedding_a / np.linalg.norm(embedding_a)
embedding_b = embedding_b / np.linalg.norm(embedding_b)

#so here they are all unit vectors now.....its helpfull for us to cal cosine similarity
similarity = np.dot(embedding_a, embedding_b)

print(f"Cosine similarity: {similarity:.4f}")