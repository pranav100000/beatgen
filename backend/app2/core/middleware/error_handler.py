"""
Error handling middleware for the FastAPI application
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import run_in_threadpool
import traceback
import time
import uuid
import logging
import json
import sys

from app2.core.exceptions import AppException
from app2.core.config import settings
from app2.core.logging import get_logger

logger = get_logger("beatgen.middleware.error_handler")

class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Middleware for handling exceptions and providing consistent error responses
    """
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        # Add request ID to request state
        request.state.request_id = request_id
        
        # Add timing
        start_time = time.time()
        
        try:
            # Process the request
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            # Categorize and log based on status code
            if response.status_code >= 500:
                # Attempt to extract response body for server errors
                try:
                    # Create a copy of the response to read the body without consuming it
                    response_body = {}
                    
                    # Try to get error details from the response if possible
                    if hasattr(response, "body"):
                        body_bytes = await run_in_threadpool(lambda: response.body)
                        if body_bytes:
                            try:
                                response_body = json.loads(body_bytes)
                            except:
                                response_body = {"raw_body": str(body_bytes)}
                    
                    # Log with the error details
                    logger.error(
                        f"Server error response: {request.method} {request.url.path} - "
                        f"Status: {response.status_code} - Time: {process_time:.3f}s - ID: {request_id}"
                    )
                    logger.error(f"Error details for request {request_id}: {response_body}")
                    
                    # Generate a stack trace for debugging context
                    current_frame = sys._getframe(0)
                    stack_trace = "".join(traceback.format_stack(current_frame))
                    logger.error(f"Server context for request {request_id}:\n{stack_trace}")
                    
                except Exception as exc:
                    # If we can't extract error details, just log what we can
                    logger.error(
                        f"Server error response (body extraction failed): {request.method} {request.url.path} - "
                        f"Status: {response.status_code} - Time: {process_time:.3f}s - ID: {request_id} - Extraction error: {str(exc)}"
                    )
                    
            elif response.status_code >= 400:
                # For client errors, try to extract basic error info
                try:
                    # Create a copy of the response to read the body without consuming it
                    response_body = {}
                    
                    # Try to get error details from the response if possible
                    if hasattr(response, "body"):
                        body_bytes = await run_in_threadpool(lambda: response.body)
                        if body_bytes:
                            try:
                                response_body = json.loads(body_bytes)
                            except:
                                # Don't log raw body for client errors to keep logs cleaner
                                pass
                    
                    # Log with available error details
                    error_detail = response_body.get("detail", "No detail provided")
                    logger.warning(
                        f"Client error response: {request.method} {request.url.path} - "
                        f"Status: {response.status_code} - Time: {process_time:.3f}s - ID: {request_id} - Detail: {error_detail}"
                    )
                    
                except Exception:
                    # If we can't extract error details, just log what we can
                    logger.warning(
                        f"Client error response: {request.method} {request.url.path} - "
                        f"Status: {response.status_code} - Time: {process_time:.3f}s - ID: {request_id}"
                    )
                    
            elif response.status_code != 404: # Skip logging 404s to reduce noise
                logger.info(
                    f"Request completed: {request.method} {request.url.path} - "
                    f"Status: {response.status_code} - Time: {process_time:.3f}s - ID: {request_id}"
                )
            
            return response
        
        except RequestValidationError as exc:
            # Calculate process time
            process_time = time.time() - start_time
            
            # Format validation errors
            details = jsonable_encoder(exc.errors())
            
            # Transform errors into a more user-friendly format
            formatted_errors = []
            for error in details:
                formatted_errors.append({
                    "field": ".".join(str(loc) for loc in error.get("loc", [])),
                    "message": error.get("msg"),
                    "type": error.get("type")
                })
            
            # Get stack trace for debugging
            stack_trace = traceback.format_exc()
            
            # Log the validation error with detail
            logger.warning(
                f"Validation error: {request.method} {request.url.path} - "
                f"Time: {process_time:.3f}s - ID: {request_id}"
            )
            logger.warning(f"Validation error details for request {request_id}: {formatted_errors}")
            logger.debug(f"Validation error stack trace for request {request_id}:\n{stack_trace}")
            
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "detail": "Validation error",
                    "code": "validation_error",
                    "errors": formatted_errors,
                    "request_id": request_id
                }
            )
            
        except AppException as exc:
            # Handle our custom exceptions
            process_time = time.time() - start_time
            
            if exc.status_code >= 500:
                logger.error(
                    f"Application error: {request.method} {request.url.path} - "
                    f"Error: {exc.detail} - Time: {process_time:.3f}s - ID: {request_id}"
                )
            else:
                logger.warning(
                    f"Application error: {request.method} {request.url.path} - "
                    f"Error: {exc.detail} - Time: {process_time:.3f}s - ID: {request_id}"
                )
            
            # Convert exception to response
            error_dict = exc.to_dict()
            error_dict["request_id"] = request_id
            
            return JSONResponse(
                status_code=exc.status_code,
                content=error_dict,
                headers=exc.headers
            )
            
        except Exception as exc:
            # Handle all other exceptions
            process_time = time.time() - start_time
            
            # Get full traceback
            tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
            trace_str = "".join(tb)
            
            logger.error(
                f"Unhandled exception: {request.method} {request.url.path} - "
                f"Error: {str(exc)} - Time: {process_time:.3f}s - ID: {request_id}"
            )
            logger.error(f"Stack trace for request {request_id}:\n{trace_str}")
            
            # Create response
            debug_mode = getattr(settings.app, "DEBUG", False)
            if debug_mode:
                # Include more details in development mode
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "detail": str(exc),
                        "code": "internal_server_error",
                        "errors": [],
                        "request_id": request_id,
                        "stack_trace": tb
                    }
                )
            else:
                # Generic error in production
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "detail": "An internal server error occurred",
                        "code": "internal_server_error",
                        "errors": [],
                        "request_id": request_id
                    }
                )