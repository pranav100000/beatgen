"""
Request Manager for handling AI assistant request IDs and tracking active requests.
Provides request ID generation, storage, and validation services.
"""
import uuid
import time
import logging
import asyncio
from enum import Enum
from typing import Dict, Any, Optional, Set
from pydantic import BaseModel

# Set up logger
logger = logging.getLogger("beatgen.request_manager")

class RequestStatus(str, Enum):
    """Status of an assistant request"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"

class RequestContext(BaseModel):
    """Context data for an assistant request"""
    request_id: str
    user_id: str
    timestamp: float
    status: RequestStatus
    mode: str
    prompt: str
    track_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    task_ref: Optional[Any] = None
    queue: Optional[asyncio.Queue] = None
    
    class Config:
        arbitrary_types_allowed = True

class RequestManager:
    """
    Manager for assistant request IDs and tracking active requests.
    Uses an in-memory store with TTL for request tracking.
    """
    # Singleton instance
    _instance = None
    
    # Class constants
    MAX_REQUESTS_PER_USER = 5
    REQUEST_TIMEOUT_SECONDS = 300  # 5 minutes
    CLEANUP_INTERVAL_SECONDS = 60  # 1 minute
    
    def __new__(cls):
        """Singleton pattern to ensure only one request manager exists"""
        if cls._instance is None:
            cls._instance = super(RequestManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize the request manager"""
        # Skip initialization if already done
        if self._initialized:
            return
            
        # Active requests by request_id
        self._requests: Dict[str, RequestContext] = {}
        
        # Set of request IDs per user
        self._user_requests: Dict[str, Set[str]] = {}
        
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        self._initialized = True
        logger.info("Request manager initialized")
    
    async def _cleanup_loop(self):
        """Background task to clean up expired requests"""
        while True:
            try:
                await asyncio.sleep(self.CLEANUP_INTERVAL_SECONDS)
                self._cleanup_expired_requests()
            except asyncio.CancelledError:
                logger.info("Cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {str(e)}")
    
    def _cleanup_expired_requests(self):
        """Clean up expired requests"""
        current_time = time.time()
        expired_requests = []
        
        # Find expired requests
        for request_id, context in self._requests.items():
            if (current_time - context.timestamp) > self.REQUEST_TIMEOUT_SECONDS:
                expired_requests.append(request_id)
        
        # Remove expired requests
        for request_id in expired_requests:
            self.remove_request(request_id, RequestStatus.TIMED_OUT)
        
        if expired_requests:
            logger.info(f"Cleaned up {len(expired_requests)} expired requests")
    
    def generate_request_id(self) -> str:
        """Generate a unique request ID with timestamp"""
        # Format: timestamp-uuid
        timestamp = int(time.time())
        unique_id = str(uuid.uuid4())
        request_id = f"{timestamp}-{unique_id}"
        return request_id
    
    def can_create_request(self, user_id: str) -> bool:
        """Check if a user can create a new request (rate limiting)"""
        user_requests = self._user_requests.get(user_id, set())
        return len(user_requests) < self.MAX_REQUESTS_PER_USER
    
    def create_request(self, 
                      user_id: str,
                      mode: str,
                      prompt: str,
                      track_id: Optional[str] = None,
                      context: Optional[Dict[str, Any]] = None) -> str:
        logger.info(f"🔵 REQUEST_MANAGER - Creating request for user: {user_id}, mode: {mode}")
        """
        Create a new request and store its context
        
        Args:
            user_id: User ID making the request
            mode: Request mode (generate, edit, chat)
            prompt: User prompt text
            track_id: Optional track ID (for edit mode)
            context: Optional additional context
            
        Returns:
            Generated request ID
            
        Raises:
            ValueError: If user has too many active requests
        """
        # Check rate limiting
        if not self.can_create_request(user_id):
            raise ValueError(f"User {user_id} has reached the maximum number of active requests")
        
        # Generate request ID
        request_id = self.generate_request_id()
        
        # Create request queue for async communication
        queue = asyncio.Queue()
        
        # Create request context
        context = RequestContext(
            request_id=request_id,
            user_id=user_id,
            timestamp=time.time(),
            status=RequestStatus.PENDING,
            mode=mode,
            prompt=prompt,
            track_id=track_id,
            context=context,
            queue=queue
        )
        
        # Store request
        self._requests[request_id] = context
        
        # Add to user requests
        if user_id not in self._user_requests:
            self._user_requests[user_id] = set()
            logger.info(f"🔵 REQUEST_MANAGER - Created new user_requests entry for user: {user_id}")
        self._user_requests[user_id].add(request_id)
        
        logger.info(f"🔵 REQUEST_MANAGER - Created request {request_id} for user {user_id}, mode: {mode}")
        logger.info(f"🔵 REQUEST_MANAGER - Active requests for user {user_id}: {self._user_requests[user_id]}")
        return request_id
    
    def get_request(self, request_id: str) -> Optional[RequestContext]:
        """Get request context by ID"""
        return self._requests.get(request_id)
    
    def update_request_status(self, request_id: str, status: RequestStatus) -> bool:
        """Update request status"""
        request = self._requests.get(request_id)
        if not request:
            return False
            
        request.status = status
        return True
    
    def set_task_reference(self, request_id: str, task_ref: Any) -> bool:
        """Set task reference for a request"""
        request = self._requests.get(request_id)
        if not request:
            return False
            
        request.task_ref = task_ref
        return True
    
    def get_queue(self, request_id: str) -> Optional[asyncio.Queue]:
        """Get the queue for a request"""
        request = self._requests.get(request_id)
        if not request:
            return None
            
        return request.queue
    
    def remove_request(self, request_id: str, status: RequestStatus = RequestStatus.COMPLETED) -> bool:
        """Remove a request and update its status"""
        request = self._requests.get(request_id)
        if not request:
            return False
            
        # Update status
        request.status = status
        
        # Remove from user requests
        user_id = request.user_id
        if user_id in self._user_requests:
            self._user_requests[user_id].discard(request_id)
            if not self._user_requests[user_id]:
                del self._user_requests[user_id]
        
        # Cancel task if it exists
        if request.task_ref and not request.task_ref.done():
            request.task_ref.cancel()
        
        # Remove from requests
        del self._requests[request_id]
        
        logger.info(f"Removed request {request_id} with status {status}")
        return True
    
    def validate_request_id(self, request_id: str, user_id: Optional[str] = None) -> bool:
        """
        Validate a request ID
        
        Args:
            request_id: Request ID to validate
            user_id: If provided, also validates that the request belongs to this user
            
        Returns:
            True if valid, False otherwise
        """
        # Check if request exists
        request = self._requests.get(request_id)
        if not request:
            return False
            
        # Check user if provided
        if user_id and request.user_id != user_id:
            return False
            
        return True
    
    def get_active_requests_count(self, user_id: Optional[str] = None) -> int:
        """Get count of active requests, optionally filtered by user"""
        if user_id:
            return len(self._user_requests.get(user_id, set()))
        else:
            return len(self._requests)
    
    async def shutdown(self):
        """Clean up resources on shutdown"""
        if hasattr(self, '_cleanup_task'):
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Clear all requests
        self._requests.clear()
        self._user_requests.clear()
        logger.info("Request manager shut down")

# Singleton instance
request_manager = RequestManager()