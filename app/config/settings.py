from pydantic_settings import BaseSettings, SettingsConfigDict
#this is important for the settings to work properly, it will load the .env file and ignore any extra variables that are not defined in the Settings class

# means  we just have to import the settings object from this file evywjere instead of creating .getenv()



class Settings(BaseSettings):
    QDRANT_URL: str
    QDRANT_API_KEY: str

    QDRANT_COLLECTION_NAME: str = "face_embeddings"

    EMBEDDING_MODEL_NAME: str = "buffalo_l"
    EMBEDDING_VECTOR_SIZE: int = 512

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()