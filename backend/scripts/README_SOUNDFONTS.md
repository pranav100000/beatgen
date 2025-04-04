# Soundfont Management Scripts

This directory contains scripts for managing soundfonts in the BeatGen application.

## add_soundfonts.py

This script allows you to add soundfont instruments to the backend storage and database.

### Prerequisites

Before running the script, make sure:

1. Your Supabase credentials are properly configured in the environment variables 
2. You have the required Python dependencies installed

### Usage

#### Adding a single soundfont

To add a single soundfont file:

```bash
python add_soundfonts.py --file /path/to/soundfont.sf2 --name "Grand Piano" --category "Piano" --description "A concert grand piano soundfont"
```

Parameters:
- `--file`: Path to the soundfont file (required)
- `--name`: Display name of the soundfont (if not provided, will use the filename)
- `--category`: Category of the soundfont (required)
- `--description`: Description of the soundfont (optional)

#### Adding multiple soundfonts from a directory

To add all .sf2 files from a directory:

```bash
python add_soundfonts.py --directory /path/to/soundfonts --category "Piano"
```

Parameters:
- `--directory`: Path to a directory containing soundfont files (required)
- `--category`: Category to assign to all soundfonts in the directory (required)

## list_soundfonts.py

This script lists all soundfonts currently in the database.

### Usage

To list all soundfonts:

```bash
python list_soundfonts.py
```

To list soundfonts in a specific category:

```bash
python list_soundfonts.py --category "Piano"
```

To get detailed JSON output:

```bash
python list_soundfonts.py --json
```

Parameters:
- `--category`: Filter soundfonts by category (optional)
- `--json`: Print detailed JSON output (optional)

## Notes

- The scripts upload soundfonts to the `assets` bucket in Supabase storage
- Soundfont files are stored with a path structure of `soundfonts_public/{category}/{uuid}/{filename}`
- The storage_key field in the database contains just `{category}/{uuid}/{filename}` (without the prefix)
- All uploaded soundfonts are stored in the `soundfont_public` table with the following fields:
  - `id` (UUID): Unique identifier
  - `name` (text): Internal name (lowercase with underscores)
  - `display_name` (text): User-friendly display name
  - `category` (text): Category for grouping
  - `description` (text): Optional description
  - `storage_key` (text): Path to the soundfont file in storage
  - `created_at` (timestamp): When the record was created

## Common Categories

Here are some common soundfont categories you might want to use:

- Piano
- Organ
- Guitar
- Bass
- Strings
- Brass
- Woodwinds
- Percussion
- Drums
- Synthesizer
- Sound Effects
- Ethnic
- Ensemble