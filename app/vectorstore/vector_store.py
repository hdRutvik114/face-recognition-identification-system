from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams , PointStruct
import uuid
from app.config.settings import settings
from qdrant_client.models import PayloadSchemaType

ENROLLMENT_THRESHOLD = 0.70

class VectorStore:

    def __init__(self):
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=60,
        )

    
    def create_collection(self):
        collections = self.client.get_collections().collections
    
        collection_names = [collection.name for collection in collections]
    
        if settings.QDRANT_COLLECTION_NAME not in collection_names:
    
            self.client.create_collection(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=settings.EMBEDDING_VECTOR_SIZE,
                    distance=Distance.COSINE,
                ),
            )
    
            print("Collection created in Qdrant.")
    
        else:
            print("Collection already exists.")
    
        collection_info = self.client.get_collection(
            settings.QDRANT_COLLECTION_NAME
        )
    
        payload_schema = collection_info.payload_schema
    
        if "image_id" not in payload_schema:
            self.client.create_payload_index(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                field_name="image_id",
                field_schema=PayloadSchemaType.KEYWORD,
            )
            print("Created image_id index.")
    
        if "person_id" not in payload_schema:
            self.client.create_payload_index(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                field_name="person_id",
                field_schema=PayloadSchemaType.KEYWORD,
            )
            print("Created person_id index.")
    
        print("Payload indexes are ready.")
    def add_embedding(self, embedding, person_name,person_id,image_id):
        point = PointStruct(
        id=str(uuid.uuid4()),
        vector=embedding.tolist(),
        payload={
            "person_name": person_name,
            "person_id": person_id,
            "image_id": image_id
        }
    )

        self.client.upsert(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            points=[point],
            wait=True,
        )

        print(f"Embedding  {person_name}.")
      
      
      
      # here i creted the search method ......
    def search(self, embedding, limit=3):
        results = self.client.query_points(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        query=embedding.tolist(),
        limit=limit,
    )

        return results.points     
           
    def image_exists(self, image_id):

        results = self.client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        scroll_filter={
            "must": [
                {
                    "key": "image_id",
                    "match": {
                        "value": image_id
                    }
                }
            ]
        },
        limit=1,
    )

        points, _ = results

        return len(points) > 0
    
    def find_top_matches(self, embedding, limit=2):
        results = self.search(embedding, limit=limit)
    
        return results 
    
    
    #this is a method to count how many id based on the person iddd
    def count_person_images(self, person_id):
        results = self.client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        scroll_filter={
            "must": [
                {
                    "key": "person_id",
                    "match": {
                        "value": person_id
                    }
                }
            ]
        },
        limit=100,
    )

        points, _ = results

        return len(points)
    
    def find_person_matches(self, embedding, limit=6):
        results = self.search(embedding, limit=limit)
    
        person_matches = {}
    
        for result in results:
            person_id = result.payload["person_id"]
    
            if person_id not in person_matches:
                person_matches[person_id] = {
                    "person_name": result.payload["person_name"],
                    "scores": []
                }
    
            person_matches[person_id]["scores"].append(result.score)
    
        return person_matches
    
    
    
    # Here we are finding the best match based on the person id and the score of the person id ...using max of same person id 
    def find_best_person_match(self, embedding, limit=6):
        person_matches = self.find_person_matches(
            embedding,
            limit=limit
        )
    
        if not person_matches:
            return None
    
        best_person = None
        best_score = float("-inf")
    
        for person_id, data in person_matches.items():
            person_score = max(data["scores"])
    
            if person_score > best_score:
                best_score = person_score
                best_person = {
                    "person_id": person_id,
                    "person_name": data["person_name"],
                    "score": person_score
                }
    
        return best_person
#here
if __name__ == "__main__":
    store = VectorStore()
    store.create_collection()