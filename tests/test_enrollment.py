from app.service.enrollment_service import EnrollmentService


service = EnrollmentService()

result = service.enroll(
    image_paths=[
        "images/sundar1.jpeg",
        "images/sundar2.jpeg",
        "images/sundar3.jpeg"
    ],
    person_name="Sundar Pichai"
)

print(result)