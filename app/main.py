from fastapi import FastAPI, UploadFile, File, Form
import tempfile
import os

from app.logging_utils import log_message, log_run_start
from app.service.enrollment_service import EnrollmentService

from app.service.identification_service import IdentificationService

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



#This is for Enroll 
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
                
      
      
#This is for the IDENTIFICATION           
@app.post("/identify")
async def identify(
    image: UploadFile = File(...)
):
    image_path = None

    try:
        suffix = os.path.splitext(image.filename)[1]

        log_message(
            f"Identification request with file '{image.filename}'"
        )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_file.write(await image.read())
            image_path = temp_file.name
        identification_service = IdentificationService()
        result = identification_service.identify(
            image_path=image_path
        )

        log_message(f"Identification result: {result}")

        return result

    finally:
        if image_path and os.path.exists(image_path):
            os.remove(image_path)