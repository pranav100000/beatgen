# Project Requirements: Implementing a POST-then-SSE Architecture for AI Assistant

## 1. Overview

This project aims to refactor the AI Assistant implementation to use a more robust architecture with a two-step communication pattern:
1. **POST Request**: Client sends message data to the server and receives a request ID
2. **SSE Connection**: Client establishes a streaming connection using the request ID to receive real-time updates

This approach provides better security, reliability, and resource management compared to the current implementation.

## 2. Technical Architecture

### 2.1 Backend Components

#### 2.1.1 Request Handler Endpoint
- **Path**: `/assistant/request`
- **Method**: POST
- **Purpose**: Accept assistant requests and return a request ID
- **Request Body**:
  ```json
  {
    "prompt": "string",
    "mode": "generate|edit|chat",
    "track_id": "string (optional)",
    "context": "object (optional)"
  }
  ```
- **Response**:
  ```json
  {
    "request_id": "string",
    "status": "string"
  }
  ```

#### 2.1.2 Request Management Service
- **Purpose**: Generate and track request IDs
- **Features**:
  - UUID generation for request IDs
  - In-memory storage of active requests
  - Request expiration/cleanup after completion or timeout
  - User request rate limiting
  - Association of request IDs with processing tasks

#### 2.1.3 Streaming Endpoint
- **Path**: `/assistant/stream/{request_id}`
- **Method**: GET
- **Purpose**: Establish SSE connection for a specific request
- **Parameters**: `request_id` in path
- **Events**:
  - `stage`: Processing stage updates
  - `status`: Status updates
  - `response_chunk`: AI response text chunks
  - `action`: Actions to execute on the frontend
  - `complete`: Final response with all data
  - `error`: Error information

#### 2.1.4 Processing Task Management
- **Purpose**: Asynchronous processing of AI requests
- **Features**:
  - Background tasks for AI processing
  - Event emission to the appropriate SSE connection
  - Resource cleanup on completion

### 2.2 Frontend Components

#### 2.2.1 Assistant API Client
- **Functions**:
  - `requestAssistant()`: Send POST request and get request ID
  - `streamAssistantResponse()`: Establish SSE connection
  - `interactWithAssistant()`: Combined function that handles both steps
- **Features**:
  - Error handling for each step
  - Request cancellation
  - Timeout management
  - Authentication token handling

#### 2.2.2 ChatWindow Component Updates
- **Changes**:
  - Update message sending flow to use two-step process
  - Add requestId tracking to ongoing conversations
  - Improve streaming message display
  - Update connection state management

## 3. Detailed Requirements

### 3.1 Backend Requirements

#### 3.1.1 Request ID Generation
- Use UUID v4 for request IDs
- Ensure uniqueness across all servers (if clustered)
- Include timestamp component for easier debugging

#### 3.1.2 Request Storage
- Store active requests in an in-memory store with TTL
- Structure: `Map<requestId, RequestContext>`
- RequestContext should include:
  - Original request data
  - User ID
  - Timestamp
  - Processing status
  - Associated task references

#### 3.1.3 Resource Management
- Limit maximum active requests per user (e.g., 5)
- Implement request expiration (e.g., 5 minutes)
- Provide cleanup mechanisms for abandoned requests
- Track and log resource usage

#### 3.1.4 Error Handling
- Validate request ID before establishing SSE
- Return appropriate HTTP status codes:
  - 201 Created: Request accepted
  - 400 Bad Request: Invalid parameters
  - 404 Not Found: Unknown request ID
  - 429 Too Many Requests: Rate limit exceeded
- Stream error events for runtime errors

### 3.2 Frontend Requirements

#### 3.2.1 API Client
- Combine both steps into a single function for easy use
- Make individual functions available for advanced use cases
- Support cancellation at any stage
- Proper TypeScript typing for all functions and parameters

#### 3.2.2 Error Recovery
- Implement reconnection logic for SSE streams
- Detect and handle server disconnections
- Show appropriate user feedback for different error types

#### 3.2.3 Streaming Experience
- Buffer chunks to avoid UI jitter
- Show typing indicator during streaming
- Support message appendix (e.g., generated code blocks after main text)
- Maintain scroll position appropriately

#### 3.2.4 DevTools Integration
- Log request/response flow for debugging
- Track active connections
- Provide connection status information

## 4. Security Considerations

### 4.1 Authentication
- Ensure both POST and SSE endpoints verify authentication
- Use same authentication mechanism for both requests
- Validate user has permission to access the request ID

### 4.2 Input Validation
- Validate all request parameters
- Sanitize prompts for potential injection attacks
- Validate request IDs against expected format

### 4.3 Rate Limiting
- Implement per-user rate limits for request creation
- Consider separate limits for different modes (generate vs. chat)
- Graceful handling of rate limit errors

## 5. Performance Requirements

### 5.1 Response Times
- Initial POST response: < 500ms
- SSE connection establishment: < 1s
- First meaningful response chunk: < 3s

### 5.2 Resource Usage
- Maximum concurrent requests per server: 1000
- Maximum memory usage per request: 10MB
- Cleanup idle connections after 60s

### 5.3 Scalability
- Design for horizontal scaling
- Stateless request handling
- Consider Redis for request storage in clustered environments

## 6. Implementation Phases

### 6.1 Phase 1: Core Infrastructure
- Implement request endpoint and ID generation
- Create basic in-memory request store
- Implement stream endpoint with request ID validation
- Update frontend API client with two-step process

### 6.2 Phase 2: Error Handling & Recovery
- Implement proper error responses
- Add reconnection logic
- Enhance frontend error handling

### 6.3 Phase 3: Performance & Security
- Add rate limiting
- Optimize streaming performance
- Implement request cleanup and resource management

### 6.4 Phase 4: Testing & Deployment
- Unit test backend components
- Integration test full request flow
- Stress test with concurrent connections
- Deploy with monitoring

## 7. Testing Requirements

### 7.1 Unit Tests
- Request ID generation
- Request storage management
- Stream event formatting
- Client reconnection logic

### 7.2 Integration Tests
- Complete request flow
- Authentication verification
- Error handling
- Rate limiting

### 7.3 Performance Tests
- Concurrent request handling
- Memory usage under load
- Connection management at scale

## 8. Monitoring Requirements

### 8.1 Metrics
- Active requests count
- Request processing time
- Error rates by type
- SSE connection duration
- Chunk transmission rates

### 8.2 Logging
- Request creation events
- Stream connection events
- Processing milestones
- Error details
- Resource cleanup events

## 9. Documentation Requirements

### 9.1 API Documentation
- Request/response formats
- Event types and structures
- Error codes and handling
- Authentication requirements

### 9.2 Implementation Documentation
- Architecture overview
- Component interactions
- Sequence diagrams for request flow
- Deployment considerations

### 9.3 Developer Documentation
- Client usage examples
- Error handling best practices
- Testing guidelines
- Performance optimization tips