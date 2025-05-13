from typing import Dict, Any, Optional
import traceback
import urllib.parse

from fastapi import Request, Response

from app2.core.logging import get_service_logger
from app2.core.exceptions import UnauthorizedException, ServiceException
from app2.infrastructure.database.supabase_client import supabase
from app2.repositories.user_repository import UserRepository
from app2.core.config import settings
from gotrue.helpers import generate_pkce_verifier, generate_pkce_challenge

logger = get_service_logger("auth")


class AuthService:
    """Service for authentication operations"""

    def __init__(self, user_repository: UserRepository):
        """
        Initialize the service with repositories

        Args:
            user_repository: The repository for user operations
        """
        self.user_repository = user_repository

    async def create_user(
        self,
        email: str,
        password: str,
        username: Optional[str] = None,
        display_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Register a new user account

        Args:
            email: User's email address
            password: User's password
            username: Optional username
            display_name: Optional display name

        Returns:
            Dict with access_token, token_type, and user_id

        Raises:
            ServiceException: If registration fails
        """
        logger.info(f"Creating new user with email: {email}")
        try:
            # Register user with Supabase Auth
            auth_response = supabase.client.auth.sign_up(
                {"email": email, "password": password}
            )

            if not auth_response.user:
                logger.error("No user returned from Supabase sign_up")
                raise ServiceException("Failed to create user account")

            user_id = auth_response.user.id
            logger.info(f"User created with Supabase Auth ID: {user_id}")

            # Create user profile in database, using the Supabase Auth ID as the primary key
            try:
                # Call the standard create_profile method
                await self.user_repository.create_profile(
                    user_id=user_id,  # This ID will be used as the primary key
                    email=email,
                    username=username,
                    display_name=display_name,
                )
                logger.info(
                    f"User profile created/ensured in public table for User ID: {user_id}"
                )
            except Exception as repo_err:
                logger.error(
                    f"Failed to create profile in public table for User ID {user_id}: {repo_err}",
                    exc_info=True,
                )
                raise ServiceException(f"Failed to save user profile: {repo_err}")

            # Return token and user info
            if auth_response.session:
                return {
                    "access_token": auth_response.session.access_token,
                    "token_type": "bearer",
                    "user_id": user_id,
                }
            else:
                return {"access_token": "", "token_type": "bearer", "user_id": user_id}
        except Exception as e:
            logger.error(f"Failed to create user: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"User registration failed: {str(e)}")

    async def login_user(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate user with email and password

        Args:
            email: User's email address
            password: User's password

        Returns:
            Dict with access_token, token_type, and user_id

        Raises:
            UnauthorizedException: If credentials are invalid
            ServiceException: If login fails due to other reasons
        """
        logger.info(f"Authenticating user with email: {email}")
        try:
            # Sign in with Supabase Auth
            auth_response = supabase.client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )

            # Extract user data
            if not auth_response.user:
                logger.error("No user returned from Supabase sign_in")
                raise UnauthorizedException("Invalid email or password")

            user_id = auth_response.user.id
            logger.info(f"User authenticated with ID: {user_id}")

            # Return token and user info
            return {
                "access_token": auth_response.session.access_token,
                "token_type": "bearer",
                "user_id": user_id,
            }
        except Exception as e:
            logger.error(f"Failed to authenticate user: {str(e)}")
            logger.error(traceback.format_exc())
            if "invalid" in str(e).lower() or "not found" in str(e).lower():
                raise UnauthorizedException("Invalid email or password")
            raise ServiceException(f"Authentication failed: {str(e)}")

    async def send_password_reset(self, email: str) -> bool:
        """
        Send password reset email

        Args:
            email: User's email address

        Returns:
            True if email was sent successfully

        Raises:
            ServiceException: If operation fails
        """
        logger.info(f"Sending password reset email to: {email}")
        try:
            # Use Supabase Auth to send password reset email
            supabase.client.auth.reset_password_email(email)
            logger.info(f"Password reset email sent to: {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to send password reset email: {str(e)}")

    async def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify a JWT token and get the user info

        Args:
            token: The JWT token to verify

        Returns:
            The user info from the token

        Raises:
            UnauthorizedException: If the token is invalid
        """
        logger.info(f"Verifying token: {token[:10]}...")
        try:
            user_info = supabase.verify_token(token)
            logger.info(f"Successfully verified token for user: {user_info['id']}")
            return user_info
        except Exception as e:
            logger.error(f"Token verification failed: {str(e)}")
            logger.error(traceback.format_exc())
            raise UnauthorizedException(f"Invalid token: {str(e)}")

    async def get_current_user(self, token: str) -> Dict[str, Any]:
        """
        Get the current user from a token

        Args:
            token: The JWT token

        Returns:
            The user info

        Raises:
            UnauthorizedException: If the token is invalid
        """
        logger.info(f"Getting current user from token: {token[:10]}...")
        return await self.verify_token(token)

    async def create_user_profile(
        self,
        user_id: str,
        email: str,
        username: Optional[str] = None,
        display_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new user profile in the database

        Args:
            user_id: The ID of the user
            email: The user's email
            username: The user's username (optional)
            display_name: The user's display name (optional)

        Returns:
            The created profile

        Raises:
            ServiceException: If the operation fails
        """
        logger.info(f"Creating user profile for user ID: {user_id}")
        try:
            profile = await self.user_repository.create_profile(
                user_id, email, username, display_name
            )
            logger.info(f"Created user profile for user ID: {user_id}")
            return profile
        except Exception as e:
            logger.error(f"Error creating user profile: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to create user profile: {str(e)}")

    async def get_google_auth_url(self, response: Response) -> str:
        """
        Generate the Google OAuth URL (using PKCE flow managed by the client library).

        Args:
            response: The outgoing FastAPI response object (no longer used for cookies here)

        Returns:
            The URL to redirect the user to for Google authentication

        Raises:
            ServiceException: If the URL cannot be generated
        """
        try:
            logger.info("Generating Google OAuth URL (PKCE handled by library)")

            # Define the backend callback URL where Google will send the code
            backend_callback_url = f"{settings.app.BASE_URL}/auth/callback/google"
            logger.info(
                f"[Service] Using callback URL: {backend_callback_url} (from settings.app.BASE_URL: {settings.app.BASE_URL})"
            )

            # Generate PKCE verifier and challenge
            pkce_verifier = generate_pkce_verifier()
            pkce_challenge = generate_pkce_challenge(pkce_verifier)
            logger.info(f"Generated PKCE verifier: {pkce_verifier[:10]}... and challenge: {pkce_challenge[:10]}...")

            # Use Supabase client to get the OAuth URL.
            auth_response = supabase.client.auth.sign_in_with_oauth(
                {
                    "provider": "google",
                    "options": {
                        "redirect_to": backend_callback_url,
                        "scopes": "openid email profile",  # Request standard scopes
                        "code_challenge": pkce_challenge, # Pass the generated challenge
                        "code_challenge_method": "S256"   # Specify the method
                    },
                }
            )

            if not auth_response or not auth_response.url:
                logger.error("Supabase sign_in_with_oauth did not return a valid URL.")
                raise ServiceException(
                    "Failed to generate Google OAuth URL from Supabase."
                )

            # Store the generated PKCE verifier in an HttpOnly cookie
            response.set_cookie(
                key="google_pkce_verifier",
                value=pkce_verifier,
                httponly=True,
                samesite="lax", # Important for OAuth redirects
                max_age=300,  # 5 minutes
                secure=settings.app.APP_ENV != "dev", # Use secure=True in prod (HTTPS)
                path="/auth", # Scope cookie to auth paths
            )
            logger.info(f"PKCE verifier stored in cookie. Verifier: {pkce_verifier[:10]}...")

            generated_url = auth_response.url
            logger.info(f"Generated OAuth URL: {generated_url[:30]}...")
            return generated_url

        except Exception as e:
            logger.error(f"Failed to generate Google OAuth URL: {str(e)}")
            logger.error(traceback.format_exc())
            raise ServiceException(f"Failed to generate Google OAuth URL: {str(e)}")

    async def handle_google_callback(
        self, code: str, request: Request, response: Response
    ) -> Dict[str, Any]:
        """
        Handle the callback from Google OAuth (PKCE handled by library).

        Args:
            code: The authorization code from Google
            request: The incoming FastAPI request object (no longer used for cookies here)
            response: The outgoing FastAPI response object (no longer used for cookies here)

        Returns:
            Dict with access_token, token_type, and user_id

        Raises:
            ServiceException: If the authentication fails
        """
        logger.info(f"[START] Received Google OAuth callback with code: {code[:10]}...")
        try:
            logger.info("Handling Google OAuth callback (PKCE handled by library)")

            # Retrieve the PKCE verifier from the cookie
            retrieved_pkce_verifier = request.cookies.get("google_pkce_verifier")
            if not retrieved_pkce_verifier:
                logger.error("[Service] PKCE verifier cookie 'google_pkce_verifier' not found in callback.")
                # Redirect to frontend with a specific error for this case
                error_desc = urllib.parse.quote("OAuth session integrity check failed. Please try logging in again.")
                error_redirect_url = f"{settings.app.FRONTEND_BASE_URL}?error=pkce_verifier_missing&error_description={error_desc}"
                logger.info(f"Redirecting to frontend with PKCE error: {error_redirect_url}")
                # This is a bit of a hack to return a redirect from within the service layer.
                # Ideally, the API layer would handle this, but for now, to match existing patterns:
                raise ServiceException(f"PKCE_REDIRECT::{error_redirect_url}") 

            logger.info(f"PKCE verifier retrieved from cookie: {retrieved_pkce_verifier[:10]}...")

            # Exchange the code for a Supabase session using PKCE
            logger.info("Exchanging code for session with PKCE verifier...")
            auth_response = supabase.client.auth.exchange_code_for_session( # type: ignore
                {"auth_code": code, "pkce_verifier": retrieved_pkce_verifier}
            )
            logger.info("Code exchanged successfully.")

            # Clean up the PKCE verifier cookie
            if response: # Ensure response object is available for cookie deletion
                response.delete_cookie(
                    key="google_pkce_verifier", 
                    path="/auth", 
                    secure=settings.app.APP_ENV != "dev", 
                    samesite="lax"
                )
                logger.info("PKCE verifier cookie deleted.")
            else:
                logger.warning("Response object not available to delete PKCE verifier cookie.")


            if not auth_response.user: # type: ignore
                logger.error("No user returned from Google OAuth after code exchange.")
                raise UnauthorizedException(
                    "Google authentication failed: Could not retrieve user session."
                )

            session_user_id = (
                auth_response.user.id
            )  # The Supabase Auth ID for this session
            email = auth_response.user.email or ""
            logger.info(
                f"Successfully exchanged code. Supabase Auth ID: {session_user_id}, Email: {email}"
            )

            logger.info(f"Ensuring profile exists for User ID: {session_user_id}")
            try:
                user_metadata = auth_response.user.user_metadata
                full_name = ""
                if isinstance(user_metadata, dict):
                    full_name = user_metadata.get("full_name", "")
                elif user_metadata:
                    logger.warning(
                        f"Unexpected type for user_metadata for user {session_user_id}: {type(user_metadata)}. Value: {user_metadata}"
                    )
                username = (
                    email.split("@")[0] if email else f"user_{session_user_id.hex[:8]}"
                )

                logger.info(f"Calling create_profile for user_id={session_user_id}...")
                await self.user_repository.create_profile(
                    user_id=session_user_id,  # Pass Supabase ID to be used as primary key
                    email=email,
                    username=username,
                    display_name=full_name,
                )
                logger.info(f"Profile ensured for User ID: {session_user_id}")
            except Exception as create_err:
                logger.error(
                    f"Failed to create/ensure profile for User ID {session_user_id}: {create_err}",
                    exc_info=True,
                )
                raise ServiceException(f"Failed to save user profile: {create_err}")

            # Return token and user info as dict
            logger.info(
                f"handle_google_callback successful for {session_user_id}. Returning token info."
            )
            return {
                "access_token": auth_response.session.access_token,
                "token_type": "bearer",
                "user_id": session_user_id,  # Return the Supabase Auth ID
            }

        except Exception as e:
            logger.error(f"Google authentication failed in service: {str(e)}")
            logger.error(traceback.format_exc())
            # Reraise to be caught by API layer
            if isinstance(e, UnauthorizedException) or isinstance(e, ServiceException):
                raise e
            else:
                raise ServiceException(f"Google authentication failed: {str(e)}")
