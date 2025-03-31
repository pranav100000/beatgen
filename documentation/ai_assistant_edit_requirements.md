# AI Assistant Edit Functionality Requirements

## Overview

This document outlines the requirements for implementing the AI assistant's edit mode, which allows users to modify existing tracks using natural language commands. The system will leverage Claude's tool calling capabilities to map user requests to specific DAW actions.

## Core Components

### 1. Action Registry for Edit Mode

A collection of tools that define all track editing actions available to the AI.

**File:** `/frontend/src/studio/core/ai/actionRegistry.ts`

**Requirements:**
- Define each editing action as a tool with detailed descriptions
- Include parameter specifications for each action
- Map each action to the corresponding history manager operation
- Cover all track-specific operations (volume, pan, mute, position, notes, etc.)
- Provide examples showing proper usage of each action

### 2. Project Serializer

A utility that prepares the current project state as context for the AI assistant.

**File:** `/frontend/src/studio/core/ai/projectSerializer.ts`

**Requirements:**
- Format track data in a structured way for AI consumption
- Include track properties (name, type, instrument, volume, pan, etc.)
- Provide note data in a compact but informative format
- Support selective serialization (e.g., only the selected track)
- Handle different track types appropriately (MIDI, audio, drum)

### 3. Backend Edit Endpoint

Enhanced `/edit` endpoint to support the tool-based action system.

**File:** `/backend/app/api/routes/assistant.py`

**Requirements:**
- Receive specific track ID for editing
- Include project context in AI prompt
- Define available tools based on the track type
- Support function calling in Claude API calls
- Process and validate tool call responses
- Handle batch processing of multiple edits

### 4. Frontend API Client

Updates to support the enhanced edit functionality.

**File:** `/frontend/src/platform/api/assistant.ts`

**Requirements:**
- Update `editTrack` method to include project context
- Process tool call responses from the API
- Add type definitions for all possible edit actions
- Provide error handling for invalid tool calls
- Support tracking of executed edits

### 5. ChatWindow Component Integration

User interface integration for the edit functionality.

**File:** `/frontend/src/studio/components/ai-assistant/ChatWindow.tsx`

**Requirements:**
- Handle edit mode activation via mode selector
- Support track selection in edit mode
- Execute tool calls returned from the API
- Map tool calls to the appropriate store methods
- Provide visual feedback for executed actions
- Allow reverting changes through history system

## Action Types (Tool Categories)

### Track Property Adjustments
- Adjust volume
- Adjust pan
- Toggle mute/solo
- Change track name
- Change track color
- Change instrument

### Track Position and Layout
- Move track (x/y position)
- Adjust track timing
- Change track duration

### Note Editing
- Add/remove notes
- Change note pitch/duration
- Adjust note velocity
- Quantize notes
- Transpose notes
- Apply rhythmic patterns

### Audio Effects
- Add/remove effects
- Adjust effect parameters
- Change routing

## Implementation Approach

1. Start with basic track property operations
2. Add position and layout operations
3. Implement note editing capabilities
4. Add advanced operations last

For each action:
1. Define the tool in the action registry
2. Map it to the appropriate history manager action
3. Implement the execution logic in the ChatWindow component
4. Test with real user prompts
5. Refine the tool description based on results

## Success Criteria

- The AI can accurately identify and execute the appropriate action based on user input
- All actions are properly tracked in history (undo/redo)
- The system handles ambiguous requests by asking for clarification
- Actions execute with the same effect as if performed manually
- The user receives clear feedback about what actions were performed