import { createFileRoute, Link } from '@tanstack/react-router'
import React from 'react'
// import { Box, Typography, Button, Container } from '@mui/material'
import { Button } from "../components/ui/button" // Assuming shadcn/ui button path
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
      <div className="container mx-auto px-4 xl:px-0 min-h-[calc(100vh-64px)] flex flex-col py-4"> {/* Replaced Container */}
        <div className="flex flex-col items-center justify-center text-center py-8 md:py-12 flex-1"> {/* Replaced Box */}
          <h1 className="mb-4 font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl"> {/* Replaced Typography */}
            BeatGen Studio
          </h1>
          
          <p className="mb-6 max-w-3xl mx-auto text-lg md:text-xl px-2"> {/* Replaced Typography */}
            Create music with our powerful digital audio workstation
          </p>
          
          <div className="flex gap-2 flex-wrap justify-center"> {/* Replaced Box */}
            {/* <Button asChild size="lg" className="py-3 px-6 text-lg"> 
              <Link to="/login">Get Started</Link>
            </Button> */} 
            <Link to="/login">
              <Button size="lg" className="py-3 px-6 text-lg">
                Get Started
              </Button>
            </Link>
            
            <a href="#features">
              <Button variant="outline" size="lg" className="py-3 px-6 text-lg">
                Learn More
              </Button>
            </a>
          </div>
        </div>
      
        <section id="features" className="py-16"> {/* Replaced Box, used section for semantics */}
          <h2 className="mb-12 text-center text-3xl md:text-4xl font-semibold"> {/* Replaced Typography */}
            Powerful Features
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"> {/* Replaced Box */}
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
              <div // Replaced Box
                key={index}
                className="bg-card p-6 rounded-lg shadow-md transition-all duration-300 ease-in-out hover:bg-card/90 hover:shadow-lg hover:-translate-y-1"
                // Assuming theme provides 'card' and 'card-foreground' or similar for background and text
                // Using bg-neutral-800/50 or similar if a specific dark theme is in play and card is not defined
                // Example: className="bg-neutral-800/50 p-6 rounded-lg transition-all duration-300 ease-in-out hover:bg-neutral-700/60 hover:-translate-y-1"
              >
                <h3 className="text-xl font-semibold mb-2 text-card-foreground"> {/* Replaced Typography */}
                  {feature.title}
                </h3>
                <p className="text-muted-foreground"> {/* Replaced Typography */}
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      
        <footer className="text-center mt-auto py-8 border-t border-border"> {/* Replaced Box, used footer for semantics */}
          <p className="text-sm text-muted-foreground"> {/* Replaced Typography */}
            © {new Date().getFullYear()} BeatGen Studio. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  )
}