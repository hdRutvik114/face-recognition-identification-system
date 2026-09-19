from app.service.identification_service import IdentificationService


service = IdentificationService()

result = service.identify("images/Building.jpeg")

print(result)