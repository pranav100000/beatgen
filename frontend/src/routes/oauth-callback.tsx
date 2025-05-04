import { createFileRoute } from '@tanstack/react-router'
import React, { useEffect, useState } from 'react'
import { 
  Box, 
  Typography, 
  CircularProgress,
  Container,
  Paper
} from '@mui/material'

// OAuth callback route - this will render at the path '/oauth-callback'
export const Route = createFileRoute('/oauth-callback')({
  component: OAuthCallbackPage,
})

function OAuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Processing authentication...')
  
  useEffect(() => {
    const processOAuthCallback = async () => {
      try {
        // Get parameters from URL
        const urlParams = new URLSearchParams(window.location.search)
        const accessToken = urlParams.get('access_token')
        const userId = urlParams.get('user_id')
        
        if (!accessToken) {
          console.error('No access token found in redirect')
          setStatus('error')
          setMessage('Authentication failed: No access token received')
          return
        }
        
        console.log('OAuth callback successful with token and user ID:', userId)
        
        // Store the token
        localStorage.setItem('access_token', accessToken)
        console.log('OAuth authentication successful, token stored')
        
        // Set success status
        setStatus('success')
        setMessage('Authentication successful! Redirecting...')
        
        // Redirect to home or requested page
        setTimeout(() => {
          const redirectTo = localStorage.getItem('auth_redirect') || '/'
          localStorage.removeItem('auth_redirect') // Clear redirect
          window.location.href = redirectTo
        }, 1500)
      } catch (error) {
        console.error('OAuth callback processing failed:', error)
        setStatus('error')
        setMessage('Authentication failed. Please try again.')
        
        // Redirect to login page after showing error
        setTimeout(() => {
          window.location.href = '/login?error=oauth_failed'
        }, 3000)
      }
    }
    
    processOAuthCallback()
  }, [])
  
  return (
    <Container maxWidth="sm" sx={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: '#000',
      color: 'white'
    }}>
      <Paper 
        elevation={3} 
        sx={{ 
          width: '100%', 
          p: 4, 
          textAlign: 'center',
          bgcolor: '#111',
          color: 'white'
        }}
      >
        <Typography variant="h5" component="h1" gutterBottom>
          {status === 'loading' ? 'Completing Sign-In' : 
           status === 'success' ? 'Sign-In Successful' : 
           'Sign-In Failed'}
        </Typography>
        
        <Box sx={{ my: 4, display: 'flex', justifyContent: 'center' }}>
          {status === 'loading' && (
            <CircularProgress color="primary" />
          )}
        </Box>
        
        <Typography>
          {message}
        </Typography>
      </Paper>
    </Container>
  )
}