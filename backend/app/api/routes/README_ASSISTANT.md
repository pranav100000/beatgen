# AI Assistant Implementation with Claude

This directory contains the implementation of the AI assistant feature for BeatGen using Claude API with tool calling capabilities.

## Files

- `assistant.py` - API endpoints for the assistant functionality
- `app/core/tools.py` - Tool definitions used by Claude to perform actions
- `app/core/project_serializer.py` - Utilities for converting project data for AI context
- `app/schemas/assistant.py` - Data models for assistant requests and responses

## Endpoints

### POST /api/assistant/chat

Legacy endpoint for general assistant interaction, handles simple commands through pattern matching.

### POST /api/assistant/generate

Endpoint for generating one or multiple tracks based on a prompt. Handles adding new tracks to the project.

### POST /api/assistant/edit

Enhanced endpoint that uses Claude's tool calling capabilities to edit tracks. Provides project context and available actions to the AI assistant.

## Tool System

The AI assistant uses the following tools to perform actions:

### Track Tools
- `adjust_volume` - Change a track's volume
- `adjust_pan` - Change a track's stereo panning
- `toggle_mute` - Mute or unmute a track
- `toggle_solo` - Solo or unsolo a track
- `rename_track` - Change a track's name
- `move_track` - Reposition a track on the timeline
- `change_instrument` - Change a track's instrument

### Project Tools
- `change_bpm` - Change the project tempo
- `change_time_signature` - Change the project time signature
- `change_key_signature` - Change the project key signature

### Utility Tools
- `identify_track` - Find a track by description

## How It Works

1. User sends an edit request with a specific track ID and a natural language prompt
2. Backend serializes project data and formats it for AI context
3. Claude is called with the prompt, context, and available tools
4. Claude analyzes the request and calls the appropriate tool(s)
5. Backend processes tool calls and converts them to actions
6. Frontend receives actions and executes them using the history manager

## Example Usage

```
POST /api/assistant/edit
{
  "prompt": "Lower the volume to 70%",
  "track_id": "track_123",
  "project_id": "project_456"
}
```

Response:
```json
{
  "response": "I've lowered the volume of the track to 70%.",
  "track": {
    "track_id": "track_123",
    "notes": [],
    "instrument": "piano",
    "name": "My Track"
  },
  "actions": [
    {
      "type": "adjust_volume",
      "data": {
        "trackId": "track_123",
        "value": 70
      }
    }
  ]
}
```

## Integration with Frontend

The frontend receives actions in the response and maps them to the appropriate history manager actions to execute them in the UI, ensuring proper undo/redo functionality.

## Future Enhancements

- Add more advanced tools for note editing
- Implement context awareness using real-time project state
- Support multi-track operations
- Add project analysis capabilities