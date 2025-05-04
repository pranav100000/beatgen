import { createFileRoute, Link } from '@tanstack/react-router'
import React from 'react'
import { Box, Typography, Button, Container } from '@mui/material'
import Navbar from '../platform/components/Navbar'
import { publicRoute } from '../platform/auth/auth-utils.tsx'

// Landing Page component - this will render at the root path '/'
export const Route = createFileRoute('/')({
  component: LandingPage,
  // Use public route utility to handle redirects for authenticated users
  ...publicRoute('/home')
})

function LandingPage() {
  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ 
        minHeight: 'calc(100vh - 64px)', // Account for navbar height
        display: 'flex', 
        flexDirection: 'column',
        py: 4,
        // Removed hardcoded bgcolor and color to allow theme to apply
        // bgcolor: '#000', 
        // color: 'white'
      }}>
      <Box 
        sx={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          py: { xs: 8, md: 12 },
          flex: 1
        }}
      >
        <Typography 
          variant="h1" 
          component="h1" 
          sx={{ 
            mb: 4, 
            fontWeight: 'bold',
            fontSize: { xs: '3rem', sm: '4rem', md: '5rem' } 
          }}
        >
          BeatGen Studio
        </Typography>
        
        <Typography 
          variant="h4" 
          component="p" 
          sx={{ 
            mb: 6, 
            maxWidth: '800px', 
            mx: 'auto',
            fontSize: { xs: '1.5rem', md: '2rem' },
            px: 2
          }}
        >
          Create music with our powerful digital audio workstation
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button 
            variant="contained" 
            color="primary" 
            size="large"
            component={Link}
            to="/login"
            sx={{ py: 1.5, px: 4, fontSize: '1.2rem' }}
          >
            Get Started
          </Button>
          
          <Button 
            variant="outlined" 
            color="primary" 
            size="large"
            component="a"
            href="#features"
            sx={{ py: 1.5, px: 4, fontSize: '1.2rem' }}
          >
            Learn More
          </Button>
        </Box>
      </Box>
      
      <Box id="features" sx={{ py: 8 }}>
        <Typography 
          variant="h2" 
          component="h2"
          sx={{ 
            mb: 6, 
            textAlign: 'center',
            fontSize: { xs: '2rem', md: '3rem' } 
          }}
        >
          Powerful Features
        </Typography>
        
        <Box 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 4
          }}
        >
          {/* Feature cards */}
          {[
            {
              title: 'Intuitive Timeline',
              description: 'Arrange your tracks on our easy-to-use timeline interface',
            },
            {
              title: 'Piano Roll Editor',
              description: 'Compose melodies and chord progressions with precision',
            },
            {
              title: 'Audio Effects',
              description: 'Apply professional-grade effects to your tracks',
            },
            {
              title: 'Project Management',
              description: 'Save and organize your projects in the cloud',
            },
            {
              title: 'Export Options',
              description: 'Share your music in various formats',
            },
            {
              title: 'Collaboration',
              description: 'Work with other musicians on shared projects',
            },
          ].map((feature, index) => (
            <Box 
              key={index}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.05)',
                p: 3,
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-5px)'
                }
              }}
            >
              <Typography variant="h5" component="h3" gutterBottom>
                {feature.title}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {feature.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      
      <Box 
        component="footer"
        sx={{ 
          textAlign: 'center', 
          mt: 'auto', 
          py: 4,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} BeatGen Studio. All rights reserved.
        </Typography>
      </Box>
    </Container>
    </>
  )
}