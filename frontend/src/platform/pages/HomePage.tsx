import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  TextField,
  CircularProgress,
  Box,
  Divider,
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import './styles/Projects.css';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon, 
  MusicNote as MusicNoteIcon,
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import SoundUploader from '../components/SoundUploader';
import SoundLibrary from '../components/SoundLibrary';
import { useAuth } from '../auth/auth-context';
import { 
  getProjects, 
  deleteProject, 
} from '../api/projects';
import { Project } from '../types/project';
import { IconTrashFilled } from '@tabler/icons-react';
import Sidebar from '../components/Sidebar';
import { useSidebar } from "../../components/ui/sidebar";
import { Button } from "../../components/ui/button"
import ProjectsDisplay from '../components/ProjectsDisplay';
import AudioTracksDisplay from '../components/AudioTracksDisplay';
import MidiLibrary from '../components/MidiLibrary';
import SamplerLibrary from '../components/SamplerLibrary';
import DrumLibrary from '../components/DrumLibrary';

// Constants for pagination and display
const INITIAL_DISPLAY_COUNT = 6;
const DISPLAY_INCREMENT = 6; // How many more to show on each click (relevant later)
const FETCH_THRESHOLD = 10; // When to fetch more from API (relevant later)
const PROJECTS_PER_PAGE_API = 20; // How many to fetch from API at a time

// const drawerWidth = 240; // No longer needed
// const collapsedDrawerWidth = 60; // No longer needed

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: sidebarActualOpen } = useSidebar();

  const [allFetchedProjects, setAllFetchedProjects] = useState<Project[]>([]);
  const [displayedProjectsCount, setDisplayedProjectsCount] = useState<number>(INITIAL_DISPLAY_COUNT);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalProjectsOnServer, setTotalProjectsOnServer] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSoundUploader, setShowSoundUploader] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    fetchAndSetInitialProjects();
  }, []);
  
  // Function to fetch sounds (will be passed to SoundLibrary for reloading)
  const fetchSounds = () => {
    // SoundLibrary component has its own fetch logic
    // This is just a placeholder to refresh the component when needed
    console.log('Refreshing sounds library');
  };

  const fetchAndSetInitialProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProjects(1, PROJECTS_PER_PAGE_API); // Fetch page 1, 20 items
      setAllFetchedProjects(response.items ?? []);
      setTotalProjectsOnServer(response.total_items ?? 0);
      const initialDisplay = Math.min(INITIAL_DISPLAY_COUNT, response.items?.length ?? 0);
      setDisplayedProjectsCount(initialDisplay);
      setCurrentPage(1);

      // Add these logs for debugging:
      console.log("Initial fetch complete. States after initial set:");
      console.log("displayedProjectsCount:", initialDisplay);
      console.log("totalProjectsOnServer:", response.total_items ?? 0);
      console.log("allFetchedProjects.length:", response.items?.length ?? 0);

    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again later.');
    } finally {
      setLoading(false);
      // Add log here too to see when loading is actually set to false
      console.log("Initial loading state (in finally block):", false);
    }
  };

  const fetchMoreProjects = async () => {
    if (loadingMore || allFetchedProjects.length >= totalProjectsOnServer) return;

    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = currentPage + 1;
      const response = await getProjects(nextPage, PROJECTS_PER_PAGE_API);
      
      setAllFetchedProjects(prevProjects => [...prevProjects, ...response.items]);
      setTotalProjectsOnServer(response.total_items ?? 0); // Update total, though it might not change often
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Error fetching more projects:', err);
      setError('Failed to load more projects.'); // You might want a less intrusive error display here
    } finally {
      setLoadingMore(false);
    }
  };

  const handleShowMoreProjects = () => {
    const newDisplayedCount = Math.min(
      displayedProjectsCount + DISPLAY_INCREMENT,
      allFetchedProjects.length
    );
    setDisplayedProjectsCount(newDisplayedCount);

    // Check if we need to fetch more from the API
    const remainingInBatch = allFetchedProjects.length - newDisplayedCount;
    const hasMoreOnServer = allFetchedProjects.length < totalProjectsOnServer;

    if (remainingInBatch < FETCH_THRESHOLD && hasMoreOnServer && !loadingMore) {
      fetchMoreProjects();
    }
  };

  const handleCreateProject = () => {
    navigate({ to: '/studio' });
  };

  const handleEditListedProject = (projectId: string) => {
    navigate({ 
      to: '/studio',
      search: { projectId } as any
    });
  };

  const handleDeleteListedProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        await fetchAndSetInitialProjects(); // Re-fetch initial set after delete
        showSnackbar('Project deleted successfully', 'success');
      } catch (err) {
        console.error('Error deleting project:', err);
        showSnackbar('Failed to delete project', 'error');
      }
    }
  };

  // Removed dialog-related handlers

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  const openListedProject = (projectId: string) => {
    navigate({ 
      to: '/studio',
      search: { projectId } as any
    });
  };

  // We'll keep the page loaded and only show a spinner in the projects area

  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar />
      <main
        style={{
          flexGrow: 1,
          padding: '2rem', // p-8 is 2rem if 1 unit = 0.25rem
          // marginLeft and transition removed - Sidebar component should manage its own width
          // and the main content will flow accordingly in the flex layout.
        }}
      >
        <Container maxWidth="lg" className="projects-container" sx={{ pt: 0, mt:0 }}>

          {error && (
            <Alert severity="error" sx={{ mb: 4 }}>
              {error}
            </Alert>
          )}

          <Paper elevation={2} sx={{ p: 3, mt: 0, borderRadius: 2, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium' }}>
                Projects
              </Typography>
              <Button
                variant="default"
                className="flex items-center gap-2"
                onClick={handleCreateProject}
              >
                <AddIcon fontSize="small" />
                New Project
              </Button>
            </Box>
            <ProjectsDisplay
              allFetchedProjects={allFetchedProjects}
              displayedProjectsCount={displayedProjectsCount}
              totalProjectsOnServer={totalProjectsOnServer}
              loading={loading}
              loadingMore={loadingMore}
              error={null}
              onCreateNewProject={handleCreateProject}
              onOpenProject={openListedProject}
              onEditProject={handleEditListedProject}
              onDeleteProject={handleDeleteListedProject}
              onShowMore={handleShowMoreProjects}
              snackbarOpen={snackbar.open}
              snackbarMessage={snackbar.message}
              snackbarSeverity={snackbar.severity}
              onCloseSnackbar={handleCloseSnackbar}
            />
          </Paper>

          {/* My Sounds Section is now replaced by AudioTracksDisplay */}
          <Paper elevation={2} sx={{ p: 3, mt: 4, borderRadius: 2, mb: 4 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'medium' }}>
              Audio Tracks
            </Typography>
            <AudioTracksDisplay onReloadSounds={fetchSounds} />
          </Paper>

          {/* Midi Tracks Section */}
          <Paper elevation={2} sx={{ p: 3, mt: 4, borderRadius: 2, mb: 4 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'medium' }}>
              MIDI Tracks
            </Typography>
            <MidiLibrary />
          </Paper>

          {/* Sampler Tracks Section */}
          <Paper elevation={2} sx={{ p: 3, mt: 4, borderRadius: 2, mb: 4 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'medium' }}>
              Sampler Tracks
            </Typography>
            <SamplerLibrary />
          </Paper>

          {/* Drum Tracks Section */}
          <Paper elevation={2} sx={{ p: 3, mt: 4, borderRadius: 2, mb: 4 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'medium' }}>
              Drum Tracks
            </Typography>
            <DrumLibrary />
          </Paper>

          {/* Snackbar for notifications */}
          <Snackbar 
            open={snackbar.open && !loading}
            autoHideDuration={6000} 
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert 
              onClose={handleCloseSnackbar} 
              severity={snackbar.severity} 
              variant="filled"
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Container>
      </main>
    </Box>
  );
}