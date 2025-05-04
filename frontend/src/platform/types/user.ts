/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

export interface SQLModel {}
/**
 * User model for the database
 */
export interface User {
  created_at?: string;
  updated_at?: string;
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}
/**
 * Base model for users
 */
export interface UserBase {
  created_at?: string;
  updated_at?: string;
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}
/**
 * API request model for creating a user
 */
export interface UserCreate {
  email: string;
  password: string;
  username?: string | null;
  display_name?: string | null;
}
/**
 * API request model for user login
 */
export interface UserLogin {
  email: string;
  password: string;
}
/**
 * API request model for changing user password
 */
export interface UserPasswordChange {
  current_password: string;
  new_password: string;
}
/**
 * API response model for user data
 */
export interface UserRead {
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}
/**
 * API request model for updating a user
 */
export interface UserUpdate {
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}
