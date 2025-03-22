from supabase import create_client, Client
from app.core.config import settings
from typing import Dict, Any, Optional

# Initialize Supabase client with URL and anon key
# Make sure these values are correctly set in your .env file
supabase: Client = create_client(
    settings.SUPABASE_URL, 
    settings.SUPABASE_KEY
)

def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verify a Supabase JWT token and return the user info
    """
    try:
        # This will validate the token and get user information
        response = supabase.auth.get_user(token)
        return response.user
    except Exception as e:
        raise Exception(f"Invalid token: {str(e)}")

def create_user_profile(user_id: str, email: str, username: Optional[str] = None, display_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new user profile in the person table
    """
    try:
        profile_data = {
            "id": user_id,  # This should match the auth.users id
            "email": email,
            "username": username,
            "display_name": display_name,
            "avatar_url": None
        }
        
        # First check if profile already exists
        check = supabase.table("person").select("*").eq("id", user_id).execute()
        
        if check.data and len(check.data) > 0:
            print(f"Profile already exists for user {user_id}")
            return check.data[0]
        
        # Insert the profile data into the person table
        result = supabase.table("person").insert(profile_data).execute()
        print(f"Profile created: {result.data}")
        return result.data
    except Exception as e:
        print(f"Error creating profile: {str(e)}")
        # Re-raise so caller can handle
        raise e