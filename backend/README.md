# BeatGen Backend API

Backend service for the BeatGen Digital Audio Workstation (DAW) application.

## Setup

1. Create a virtual environment:
   ```
   python -m venv venv
   ```

2. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - MacOS/Linux: `source venv/bin/activate`

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file based on `.env.example` and configure your Supabase credentials.

5. Run the server:
   ```
   uvicorn app.main:app --reload
   ```

## API Endpoints

The API will be available at `http://localhost:8000`:

- `/api/auth/signup` - Register a new user
- `/api/auth/login` - Authenticate user
- `/api/auth/forgot-password` - Send password reset email
- `/api/users/me` - Get current user profile
- `/api/users/me` (PATCH) - Update user profile
- `/api/users/me/avatar` - Upload user avatar
- `/api/users/me/password` - Change password
- `/api/projects` - List/create projects
- `/api/projects/{id}` - Get/update/delete project
- `/api/projects/{id}/tracks` - Manage project tracks

## Supabase Setup

1. Set up Supabase tables:

```sql
-- Create person table
create table person (
  id uuid primary key references auth.users,
  email text not null unique,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create project table
create table project (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  bpm float default 120.0,
  time_signature text default '4/4',
  tracks jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index project_user_id_idx on project(user_id);
-- Create Row Level Security policies
-- Profiles: Users can only read their own profile
alter table person enable row level security;
create policy "Users can read own record" on person for select using (auth.uid() = user_id);
create policy "Users can update own record" on person for update using (auth.uid() = user_id);

-- Projects: Users can CRUD their own projects
alter table projects enable row level security;
create policy "Users can CRUD own projects" on projects for all using (auth.uid() = user_id);
```

2. Create storage buckets:
   - Create `avatars` bucket for user profile images
   - Set up proper bucket policies

## Development

- API documentation is available at `/docs` when the server is running
- Run tests with `pytest`