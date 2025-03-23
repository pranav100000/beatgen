# Project Requirements Document (PRD)

## 1. Project Overview

The project is to build an online Digital Audio Workstation (DAW) web application using React. It targets hobbyists and is focused on allowing users to upload audio files and create MIDI tracks, enhanced with AI features. The app already supports audio file uploads and has an undo/redo history manager based on actions rather than state, but it still needs a robust audio engine to play files correctly and a functional playback cursor. In addition, the creative power of the app will be boosted by backend-driven AI that generates MIDI tracks and sounds.

The main purpose of the DAW is to provide a user-friendly, intuitive workspace where users can easily manage, create, and refine their audio projects. Success will be measured by smoother workflow, minimal latency during audio playback, accurate synchronization of audio and MIDI, and seamless integration of AI-generated content. The application also includes user registration, project saving, and collaboration features to help hobbyists manage and share their work effectively.

## 2. In-Scope vs. Out-of-Scope

**In-Scope:**

*   Building the web application using React as the frontend technology.
*   Implementing features for uploading audio files that automatically add new tracks to the timeline.
*   Creating functionality for generating and integrating AI-assisted MIDI tracks via backend requests.
*   Enhancing the audio engine by integrating Tone.js to ensure the correct timing and synchronization between audio and MIDI playback.
*   Fixing playback issues such as implementing a movable playback cursor and preventing the restart of tracks from the beginning on play.
*   Implementing user registration, secure authentication (likely using JWT), project saving, and basic collaboration functionality.

**Out-of-Scope:**

*   Advanced monetization models or complex monetization features.
*   In-depth professional production tools aimed at professional producers.
*   Extensive UI/UX design guidelines or custom branding elements; focus is on functionality for hobbyists.
*   Future expanded collaboration tools beyond basic sharing and project saving.
*   Any features not directly related to ensuring a working and precise DAW experience for hobbyists at this stage.

## 3. User Flow

When a new user visits the online DAW, they are greeted with a simple landing screen prompting them to register or log in. After authentication, they are taken to a personalized dashboard where they can see a list of saved projects or start a new one. In the project workspace, the user can upload audio files directly; upon a successful upload, the system automatically adds a new track to the timeline and logs the action using the history manager.

Once in the workspace, the user can also use the integrated AI features to generate MIDI tracks and sounds. When the user triggers an AI request, the app sends the relevant details to the backend, processes the AI-generated response, and integrates the generated MIDI into the current session. After adjusting their tracks, the user can control playback with a timeline that uses Tone.js to synchronize audio and MIDI. Although the current playback cursor and timing mechanisms need further work, the goal is to make it possible to move the cursor and start playback from any point on the timeline.

## 4. Core Features

*   **Audio File Upload:**

    *   Allow users to upload audio files.
    *   Auto-add a new track to the timeline upon a successful upload.

*   **Track Creation and Management:**

    *   Integrate a history manager that records user actions for undo and redo functionality.

*   **AI-Assisted MIDI Generation:**

    *   Provide a UI control to request AI-generated MIDI tracks and sounds.
    *   Backend integration to process AI requests and return generated MIDI content.
    *   Integrate the AI-generated content into the current project session.

*   **Audio Engine and Playback Controls:**

    *   Use Tone.js for precise audio playback and MIDI sequencing.
    *   Implement a working playback cursor that can be moved and accurately tracks playback position.
    *   Ensure audio and MIDI tracks are synchronized and do not restart unexpectedly.

*   **User Management and Collaboration:**

    *   Registration and secure authentication (JWT).
    *   Project saving so users can store and return to their work later.
    *   Basic collaboration features for sharing projects.

## 5. Tech Stack & Tools

*   **Frontend:**

    *   React – for building the user interface and managing components.
    *   Tone.js – used for audio playback and handling MIDI functionalities.

*   **Backend:**

    *   Node.js – to create API endpoints for user management, project saving, and AI requests.
    *   Postgres – for persisting user projects and data.
    *   Supabase Storage – for storing audio files and MIDI files.
    *   JWT – for managing user authentication and session security.

*   **AI Integration:**

    *   Integration with backend AI models for generating MIDI tracks and sounds (the model specifics can be defined further as necessary).

*   **Developer Tools:**

    *   Cursor – an advanced IDE being used for AI-powered coding with real-time suggestions to enhance development productivity.

## 6. Non-Functional Requirements

*   **Performance:**

    *   Minimize latency during audio playback and user interactions.
    *   Ensure near real-time response when playing back audio and MIDI tracks once fixed.

*   **Security:**

    *   Utilize JWT for secure user authentication.
    *   Protect user data (projects and profiles) in the database.

*   **Usability:**

    *   Provide an intuitive, hobbyist-friendly interface.
    *   Ensure that features like audio upload and MIDI generation are easy to use.

*   **Reliability:**

    *   Maintain robust undo/redo functionality via the history manager.
    *   Ensure that multilayered track additions and playback are consistent and repeatable.

## 7. Constraints & Assumptions

*   The project assumes the availability and proper functioning of Tone.js for audio processing.
*   The AI features depend on backend integration and the ability to process and return MIDI information reliably.
*   The history manager currently supports action-based undo/redo, and this design will be carried forward.
*   User flows and functionalities are tailored for hobbyists, not for professional producers; hence, the feature set is balanced towards simplicity.
*   It is assumed that the development environment includes tools like the Cursor IDE, which supports the overall workflow.

## 8. Known Issues & Potential Pitfalls

*   **Audio Engine Limitations:**

    *   The current audio engine does not play files at the right time; issues include incorrect playback cursor behavior and restarting all tracks on play.
    *   Mitigation: Focus on implementing precise time controls and ensure Tone.js is correctly integrated with playback events.

*   **Playback Cursor Issues:**

    *   The cursor is not implemented correctly or movable, which may confuse users.
    *   Mitigation: Redesign the playback cursor functionality with clear state management and synchronization with the audio engine.

*   **AI Integration Dependencies:**

    *   Reliance on backend AI services means that delays or errors in the AI request/response process will affect user experience.
    *   Mitigation: Implement error handling and provide user feedback in case the AI service is temporarily unavailable.

*   **Synchronization Between Audio and MIDI:**

    *   Merging AI-generated MIDI tracks with uploaded audio requires precise timing to avoid desynchronization.
    *   Mitigation: Prioritize fixing timeline management and possibly use a callback or event-driven model to ensure synchronization.

This document should serve as the comprehensive guide for subsequent technical documents like Tech Stack, Frontend Guidelines, Backend Structure, and more. Every component described here will be used as the main reference to inform and structure development, ensuring that there is no ambiguity or missing information during implementation.
