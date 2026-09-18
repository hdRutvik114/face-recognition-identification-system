from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from app.config.settings import settings


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
           
           
           
           
           
#here
if __name__ == "__main__":
    store = VectorStore()
    store.create_collection()