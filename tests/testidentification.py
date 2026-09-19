from app.service.identification_service import IdentificationService


service = IdentificationService()

result = service.identify("images/yan_lecun2.jpeg")

print(result)