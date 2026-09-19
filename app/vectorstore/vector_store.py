from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams , PointStruct
import uuid
from app.config.settings import settings

ENROLLMENT_THRESHOLD = 0.70

class VectorStore:

    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY,)

    
    def create_collection(self):
        collections = self.client.get_collections().collections
         #here man what we do is actually we are checking that the qdant collection exist or nto ...if it exists then we print  that the hcollection exitss he
        collection_namess = [collection.name for collection in collections]

        if settings.QDRANT_COLLECTION_NAME not in collection_namess: 
            self.client.create_collection(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=settings.EMBEDDING_VECTOR_SIZE, distance=Distance.COSINE,
                ),
            )
            print("Collection we created in qdrantt.")
        else:
            print("Collection is there alreadry .")
    
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
        points=[point]
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
           
#here
if __name__ == "__main__":
    store = VectorStore()
    store.create_collection()