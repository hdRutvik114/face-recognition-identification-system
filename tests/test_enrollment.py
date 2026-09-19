from app.service.enrollment_service import EnrollmentService


service = EnrollmentService()

result = service.enroll(
    image_paths=[
        "images/yan_lecun6.jpeg",
    ],
    person_name="Yan LeCun"
)

print(result)