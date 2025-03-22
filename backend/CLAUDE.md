# CLAUDE.md - BeatGen Backend

## Run Commands
- `python -m venv venv` - Create virtual environment
- `source venv/bin/activate` - Activate virtual environment (Mac/Linux)
- `venv\Scripts\activate` - Activate virtual environment (Windows)
- `pip install -r requirements.txt` - Install dependencies
- `uvicorn app.main:app --reload` - Run the development server
- `pytest` - Run tests

## Database Schema
- **person**
  - id uuid (primary key, references auth.users)
  - email text (unique)
  - username text (unique)
  - display_name text
  - avatar_url text
  - created_at timestamp
  - updated_at timestamp

- **project**
  - id uuid (primary key)
  - user_id uuid (references person.id)
  - name text
  - bpm float
  - time_signature_numerator int
  - time_signature_denominator int
  - tracks jsonb
  - created_at timestamp
  - updated_at timestamp

- **audio_track**
  - id uuid (primary key)
  - user_id uuid (references person.id)
  - name text
  - file_format text
  - duration float
  - file_size int
  - sample_rate int
  - waveform_data jsonb
  - created_at timestamp
  - updated_at timestamp
  - storage_key text

- **midi_track**
  - id uuid (primary key)
  - project_id uuid (references project.id)
  - user_id uuid (references person.id)
  - name text
  - bpm float
  - created_at timestamp
  - updated_at timestamp
  - storage_key text

## API Endpoints
- `/api/auth/signup` - Register a new user
- `/api/auth/login` - Authenticate user
- `/api/auth/forgot-password` - Send password reset email
- `/api/users/me` - Get/update current user profile
- `/api/users/me/avatar` - Upload user avatar
- `/api/users/me/password` - Change password
- `/api/projects` - List/create projects
- `/api/projects/{id}` - Get/update/delete project
- `/api/projects/{id}/tracks` - Manage project tracks

## Important Notes
- Table name is "project" (singular) in the database, not "projects"
- Person table connects to auth.users for authentication
- JSON schema for tracks is stored in the tracks field
- Row Level Security is enabled on tables