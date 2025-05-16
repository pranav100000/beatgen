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
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "../../components/ui/button"
import ProjectsDisplay from '../components/ProjectsDisplay';
import AudioTracksDisplay from '../components/AudioTracksDisplay';
import MidiLibrary from '../components/MidiLibrary';
import SamplerLibrary from '../components/SamplerLibrary';
import DrumLibrary from '../components/DrumLibrary';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Page } from '../types/pagination';

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
  const queryClient = useQueryClient();

  const [displayedProjectsCount, setDisplayedProjectsCount] = useState<number>(INITIAL_DISPLAY_COUNT);
  const [currentPageApi, setCurrentPageApi] = useState<number>(1);

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

  const { 
    data: projectsData, 
    isLoading: loadingProjects, 
    error: projectsError,
    isFetching: isFetchingProjects,
  } = useQuery<Page<Project>, Error, Page<Project>, [string, number, number]>({
    queryKey: ['projects', currentPageApi, PROJECTS_PER_PAGE_API],
    queryFn: () => getProjects(currentPageApi, PROJECTS_PER_PAGE_API),
    placeholderData: (previousData) => previousData,
  });
  
  const allFetchedProjects = projectsData?.items ?? [];
  const totalProjectsOnServer = projectsData?.total_items ?? 0;

  useEffect(() => {
    if (projectsData?.items) {
      const initialDisplay = Math.min(INITIAL_DISPLAY_COUNT, projectsData.items.length);
      setDisplayedProjectsCount(initialDisplay);
    }
  }, [projectsData?.items]);

  const fetchSounds = () => {
    console.log('Refreshing sounds library');
  };

  const handleShowMoreProjects = () => {
    const newDisplayedCount = Math.min(
      displayedProjectsCount + DISPLAY_INCREMENT,
      allFetchedProjects.length
    );
    setDisplayedProjectsCount(newDisplayedCount);

    const hasMoreOnServer = allFetchedProjects.length < totalProjectsOnServer;
    if (newDisplayedCount >= allFetchedProjects.length && hasMoreOnServer && !isFetchingProjects) {
      if (projectsData && currentPageApi < projectsData.total_pages ) {
         setCurrentPageApi(prev => prev + 1);
      }
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

  const { mutate: performDeleteProject } = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      showSnackbar('Project deleted successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      console.error('Error deleting project:', err);
      showSnackbar('Failed to delete project', 'error');
    },
  });

  const handleDeleteListedProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      performDeleteProject(projectId);
    }
  };

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

          {projectsError && (
            <Alert severity="error" sx={{ mb: 4 }}>
              {projectsError.message || 'Failed to load projects. Please try again later.'}
            </Alert>
          )}

          <Paper elevation={2} sx={{ p: 3, mt: 0, borderRadius: 2 }}>
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
              loading={loadingProjects}
              loadingMore={isFetchingProjects && currentPageApi > 1}
              error={projectsError ? projectsError.message : null}
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
          <Paper elevation={2} sx={{ p: 3, mt: 4, borderRadius: 2 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'medium' }}>
              Audio Tracks
            </Typography>
            <AudioTracksDisplay onReloadSounds={fetchSounds} />
          </Paper>

          {/* Midi Tracks Section */}
          <Paper elevation={2} sx={{ p: 3, mt: 4, borderRadius: 2 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'medium' }}>
              MIDI Tracks
            </Typography>
            <MidiLibrary />
          </Paper>

          {/* Sampler Tracks Section */}
          <Paper elevation={2} sx={{ p: 3, mt: 4, borderRadius: 2 }}>
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
            open={snackbar.open && !loadingProjects}
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