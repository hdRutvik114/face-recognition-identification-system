from app.service.identification_service import IdentificationService


service = IdentificationService()

image_path = "images/yan_lecun2.jpeg"

image = service.face_app.get(
    __import__("cv2").imread(image_path)
)

embedding = image[0].embedding
best = service.vector_store.find_best_person_match(
    embedding
)

print("Best one ",best)
matches = service.vector_store.find_person_matches(
    embedding,
    limit=6
)

for person_id, data in matches.items():
    print(
        person_id,
        data["person_name"],
        data["scores"]
    )