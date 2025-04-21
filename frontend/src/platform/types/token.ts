/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

export interface SQLModel {}
/**
 * Model for authentication token responses
 */
export interface Token {
  access_token: string;
  token_type?: string;
  message?: string | null;
  user_id?: string | null;
}
/**
 * Model for token payload data
 */
export interface TokenPayload {
  sub?: string | null;
  exp?: number | null;
}
