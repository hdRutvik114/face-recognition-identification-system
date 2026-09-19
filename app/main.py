from fastapi import FastAPI, UploadFile, File, Form
import tempfile
import os

from app.logging_utils import log_message, log_run_start
from app.service.enrollment_service import EnrollmentService


log_run_start()

app = FastAPI(
    title="Face Recognition Identification System"
)

enrollment_service = EnrollmentService()


@app.get("/")
def root():
    log_message("GET / called")
    return {
        "message": "Face Recognition API is running"
    }


@app.post("/enroll")
async def enroll(
    name: str = Form(...),
    image: UploadFile = File(...)
):
    image_paths = []

    try:
        suffix = os.path.splitext(image.filename)[1]
        log_message(f"Enrollment request for '{name}' with file '{image.filename}'")

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_file.write(await image.read())
            image_paths.append(temp_file.name)

        result = enrollment_service.enroll(
            image_paths=image_paths,
            person_name=name
        )

        log_message(f"Enrollment result: {result}")
        return result

    finally:
        for path in image_paths:
            if os.path.exists(path):
                os.remove(path)