from app.service.enrollment_service import EnrollmentService


service = EnrollmentService()

result = service.enroll(
    image_path="images/andrew_karpathy.jpg",
    person_name="Rithvik"
)

print(result)