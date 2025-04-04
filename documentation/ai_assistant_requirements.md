# AI Assistant Integration - Revised Project Requirements Document

## 1. Project Overview

The AI Assistant integration will add conversational AI capabilities to the BeatGen digital audio workstation (DAW), enabling users to interact with the application using natural language. The assistant will help users with music production tasks, provide suggestions, and execute commands through the UI based on user prompts. The assistant will be implemented as a collapsible chat bubble in the corner of the interface for minimal intrusion and maximum accessibility.

## 2. Scope and Objectives

### 2.1 Objectives
- Provide intuitive AI assistance within the BeatGen studio environment
- Enable natural language control of DAW features
- Reduce complexity for new users through conversational guidance
- Enhance productivity for all users through AI-powered shortcuts
- Maintain a clean, unobtrusive UI that doesn't interfere with the creative process

### 2.2 Success Criteria
- Users can successfully interact with the AI to execute common DAW actions
- The assistant responds appropriately to music production questions
- UI actions triggered by the AI work correctly
- Latency remains below 2 seconds for most interactions
- The chat interface doesn't obstruct key UI elements during usage
- Chat bubble state persists across different views in the studio

## 3. Functional Requirements

### 3.1 Core Functionality
- Text-based chat interface for communicating with the AI
- Natural language processing of user queries
- Contextual awareness of the current project state
- Ability to perform actions on behalf of the user
- Collapsible interface that minimizes to a small bubble when not in use

### 3.2 AI Capabilities
- Answer general music production questions
- Provide BeatGen usage guidance
- Suggest appropriate settings based on context
- Execute commands affecting the DAW state
- Remember context from previous messages in the same session

### 3.3 Supported Actions
The AI assistant must be able to execute the following actions:
- Modify BPM/tempo (e.g., "Set tempo to 120 BPM")
- Add new tracks with specified instruments (e.g., "Add a drum track")
- Adjust track volume, panning, and effects (e.g., "Set track 2 volume to 80%")
- Generate musical patterns based on descriptions (e.g., "Create a basic drum pattern")
- Navigate to different areas of the application (e.g., "Open the piano roll for track 3")
- Change time signature (e.g., "Change time signature to 3/4")
- Toggle track mute/solo states (e.g., "Mute track 1")

## 4. Technical Requirements

### 4.1 API Integration
- Backend REST endpoint for AI communication at `/api/assistant/chat`
- Request schema with `prompt`, optional `track_id`, and `context` fields
- Response schema with `response` text and optional `actions` array
- Authentication using existing user token mechanism
- Structured action format with consistent `type` and `data` fields
- Error handling with appropriate HTTP status codes and messages

### 4.2 Frontend Implementation
- Collapsible chat bubble component positioned in the bottom-right corner
- Expandable chat panel with message history and input field
- Message display with visual distinction between user and AI messages
- Action handling system to process and execute AI instructions
- Message persistence during studio session
- Loading indicator during API interactions

### 4.3 Performance Requirements
- Response time < 2 seconds for typical queries
- Minimal impact on audio engine performance
- Efficient state updates to prevent UI freezing
- Chat panel animation should be smooth (60fps)
- Maximum of 250ms latency for expanding/collapsing the chat panel

## 5. User Interface

### 5.1 Chat Bubble
- Circular button with AI icon positioned in bottom-right corner
- Consistent primary color matching the app's theme
- Subtle hover effect to indicate interactivity
- Badge indicator for new/unread AI suggestions (optional)
- Z-index high enough to remain above other UI elements

### 5.2 Chat Panel
- Dimensions: 320px width × 400px height when expanded
- Semi-transparent dark background matching studio theme
- Clear header with "AI Assistant" title and close button
- Scrollable message area with user messages right-aligned, AI messages left-aligned
- Different background colors for user vs. AI messages
- Text input field with send button at bottom
- Loading indicator during API calls
- Smooth animation for expand/collapse transitions (300ms duration)

### 5.3 User Experience
- Chat bubble remains visible across all studio views
- Bubble expands on click to show the chat interface
- Welcome message displays when opened for the first time
- Clear visual feedback when AI is processing a request
- Notification when AI performs an action (e.g., "Changed tempo to 120 BPM")
- Enter key sends messages for keyboard efficiency
- Auto-scroll to bottom when new messages arrive

## 6. Integration Requirements

### 6.1 Backend Integration
- New API route at `/api/assistant/chat` in the FastAPI app
- Access to project and track data from the database
- Connection to external AI service (implementation-specific)
- Authentication using existing `get_current_user` dependency
- Structured error responses matching existing API patterns

### 6.2 Frontend Integration
- Component placement in the main studio layout component
- Access to global state via useStudioStore for executing actions
- Consistent styling with BeatGen's existing dark theme
- Typescript interfaces for type safety
- Proper Z-index management to ensure visibility across screens

## 7. Implementation Details

### 7.1 Component Architecture
- `ChatBubble.tsx`: Main component containing both collapsed and expanded states
- Expanded panel implemented using Material-UI Collapse component
- Message display implemented with flexbox for proper alignment
- UseRef for scrolling to latest messages
- UseState for managing local component state (messages, input, loading status)

### 7.2 State Management
- Local component state for UI elements (isOpen, messages, prompt)
- Global application state accessed via useStudioStore for actions
- Message history stored in component state during session
- Actions directly modify application state via store methods

### 7.3 Action Handling
- Action processor in handleSend function with switch/case structure
- Action types: 'change_bpm', 'add_track', 'adjust_volume', etc.
- Each action type mapped to corresponding store method
- Feedback provided to user after action execution
- Error handling for failed actions

## 8. API Structure

### 8.1 Request Format
```typescript
interface AssistantRequest {
  prompt: string;
  track_id?: string;
  project_id?: string;
  context?: {
    [key: string]: any;
  };
}
```

### 8.2 Response Format
```typescript
interface AssistantResponse {
  response: string;
  track_id?: string;
  actions?: Array<{
    type: string;
    data: {
      [key: string]: any;
    };
  }>;
}
```

### 8.3 Action Types
- `change_bpm`: Change global tempo
  - Data: `{ value: number }`
- `change_key`: Change key signature
  - Data: `{ value: number }`
- `add_track`: Add a new track
  - Data: `{ type: 'audio' | 'midi' | 'drum', instrumentId?: string }`
- `adjust_volume`: Change track volume
  - Data: `{ trackId: string, value: number }`
- `adjust_pan`: Change track panning
  - Data: `{ trackId: string, value: number }`
- `toggle_mute`: Toggle track mute state
  - Data: `{ trackId: string, muted: boolean }`
- `toggle_solo`: Toggle track solo state
  - Data: `{ trackId: string, soloed: boolean }`
- `change_time_signature`: Change project time signature
  - Data: `{ numerator: number, denominator: number }`

## 9. Implementation Plan

### 9.1 Phase 1: Core Implementation (Week 1)
- Create backend API endpoint with basic response functionality
- Implement ChatBubble component with expand/collapse functionality
- Add simple message display and input field
- Implement basic action handling for BPM changes

### 9.2 Phase 2: Enhanced Capabilities (Week 2)
- Connect to external AI service for actual NLP processing
- Implement full set of action handlers
- Add message history with proper styling
- Improve error handling and feedback

### 9.3 Phase 3: Polish and Optimization (Week 3)
- Add loading indicators and animations
- Optimize performance for large message histories
- Implement context awareness (sharing project state with AI)
- Add automated suggestions based on user activity
- Comprehensive testing and bug fixes

## 10. Testing Requirements

### 10.1 Unit Testing
- Test API client for correct request/response handling
- Test action execution functions
- Test UI component rendering and state changes
- Test message display and formatting

### 10.2 Integration Testing
- Test end-to-end workflows with actual API calls
- Verify UI updates correctly after actions
- Test with various screen sizes and device types
- Ensure Z-index and positioning work across all studio views

### 10.3 User Testing
- Test with beginner, intermediate, and advanced users
- Gather feedback on response quality and accuracy
- Measure impact on production workflow speed
- Identify most frequently used commands for optimization

## 11. Documentation Requirements

### 11.1 User Documentation
- "Getting Started with the AI Assistant" guide
- List of example commands users can try
- Documentation on capabilities and limitations
- Troubleshooting section for common issues

### 11.2 Developer Documentation
- API endpoint documentation with request/response formats
- Component structure and state management explanation
- Guide for adding new AI action types
- Integration points with the main application

## 12. Future Enhancements

### 12.1 Short-term Improvements
- Keyboard shortcut to toggle chat bubble (Alt+A)
- Support for sending audio snippets to the AI
- Inline reference links in AI responses
- Quick action buttons in messages (e.g., "Set tempo to [120]")

### 12.2 Long-term Vision
- Voice input capability
- Proactive suggestions based on user activity
- Integration with audio analysis for feedback on mix
- Personalized assistant that learns user preferences
- AI-generated music and pattern suggestions

## 13. Success Metrics

- User engagement: Percentage of users who interact with the assistant
- Task completion: Success rate of AI-executed actions
- Message volume: Average messages per session
- Feature discovery: New features used after AI suggestion
- Time savings: Reduction in time to complete common tasks
- User satisfaction: Feedback ratings from in-app surveys