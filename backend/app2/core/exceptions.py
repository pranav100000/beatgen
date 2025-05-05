from typing import Any, Dict, Optional, List
from fastapi import HTTPException, status
import traceback
from .logging import get_logger

logger = get_logger("beatgen.exceptions")


class AppException(HTTPException):
    """Base exception for application-specific errors"""

    def __init__(
        self, status_code: int, detail: str, headers: Optional[Dict[str, Any]] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        logger.error(f"AppException: {detail}")


class NotFoundException(AppException):
    """Exception raised when a resource is not found"""

    def __init__(self, resource_name: str, resource_id: Optional[str] = None):
        detail = f"{resource_name} not found"
        if resource_id:
            detail = f"{resource_name} with ID {resource_id} not found"
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class UnauthorizedException(AppException):
    """Exception raised when a user is not authorized to access a resource"""

    def __init__(self, detail: str = "Unauthorized"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(AppException):
    """Exception raised when a user does not have permission to perform an action"""

    def __init__(self, detail: str = "Forbidden"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class BadRequestException(AppException):
    """Exception raised when a request is invalid"""

    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class ServiceException(AppException):
    """Exception raised when a service operation fails"""

    def __init__(
        self, detail: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    ):
        super().__init__(status_code=status_code, detail=detail)
        logger.error(traceback.format_exc())


class DatabaseException(ServiceException):
    """Exception raised when a database operation fails"""

    def __init__(self, detail: str = "Database operation failed"):
        super().__init__(detail=detail)


class StorageException(ServiceException):
    """Exception raised when a storage operation fails"""

    def __init__(self, detail: str = "Storage operation failed"):
        super().__init__(detail=detail)


class ValidationException(BadRequestException):
    """Exception raised when input validation fails"""

    def __init__(
        self,
        detail: str = "Validation error",
        errors: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(detail=detail)
        self.errors = errors
