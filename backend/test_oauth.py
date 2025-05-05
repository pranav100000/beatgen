import logging
import asyncio
from app2.services.auth_service import AuthService
from app2.repositories.user_repository import UserRepository

# Set up logging
logging.basicConfig(level=logging.INFO)


# Test function
async def test_oauth():
    repo = UserRepository()
    service = AuthService(repo)
    url = await service.get_google_auth_url()
    print(f"\nGenerated OAuth URL: {url}\n")


# Run the test
if __name__ == "__main__":
    asyncio.run(test_oauth())
