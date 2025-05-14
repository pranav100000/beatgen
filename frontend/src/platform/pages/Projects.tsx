import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Button, 
  IconButton, 
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
  Edit as EditIcon, 
  MusicNote as MusicNoteIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import SoundLibrary from '../components/SoundLibrary';
import { useAuth } from '../auth/auth-context';
import { 
  getProjects, 
  deleteProject, 
} from '../api/projects';
import { Project } from '../types/project';
import { IconTrashFilled } from '@tabler/icons-react';


// Constants for pagination and display
const INITIAL_DISPLAY_COUNT = 6;
const DISPLAY_INCREMENT = 6; // How many more to show on each click (relevant later)
const FETCH_THRESHOLD = 10; // When to fetch more from API (relevant later)
const PROJECTS_PER_PAGE_API = 20; // How many to fetch from API at a time

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
      setAllFetchedProjects(response.items);
      setTotalProjectsOnServer(response.total_items);
      const initialDisplay = Math.min(INITIAL_DISPLAY_COUNT, response.items.length);
      setDisplayedProjectsCount(initialDisplay);
      setCurrentPage(1);

      // Add these logs for debugging:
      console.log("Initial fetch complete. States after initial set:");
      console.log("displayedProjectsCount:", initialDisplay);
      console.log("totalProjectsOnServer:", response.total_items);
      console.log("allFetchedProjects.length:", response.items.length);

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
      setTotalProjectsOnServer(response.total_items); // Update total, though it might not change often
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Error fetching more projects:', err);
      setError('Failed to load more projects.'); // You might want a less intrusive error display here
    } finally {
      setLoadingMore(false);
    }
  };

  const handleShowMore = () => {
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

  const handleEditProject = (project: Project) => {
    navigate({ 
      to: '/studio',
      search: { projectId: project.id } as any
    });
  };

  const handleDeleteProject = async (projectId: string) => {
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

  const openProject = (projectId: string) => {
    navigate({ 
      to: '/studio',
      search: { projectId } as any
    });
  };

  // We'll keep the page loaded and only show a spinner in the projects area

  return (
    <Container maxWidth="lg" className="projects-container">
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate({ to: '/' })}
        sx={{ mb: 2 }}
      >
        Back to Home
      </Button>
      <Box className="project-header">
        <Typography variant="h3" component="h1" sx={{ color: 'text.primary' }}>
          Projects
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate({ to: '/studio' })}
        >
          New Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Paper className="project-empty-state" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading your projects...
          </Typography>
        </Paper>
      ) : allFetchedProjects.length === 0 ? (
        <Paper className="project-empty-state">
          <MusicNoteIcon className="project-empty-icon" />
          <Typography variant="h6" gutterBottom>
            No projects yet
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Create your first music project to get started!
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => navigate({ to: '/studio' })}
          >
            Create Project
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {allFetchedProjects.slice(0, displayedProjectsCount).map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card className="project-card">
                <CardContent className="project-card-content">
                  <Typography variant="h6" component="h2" gutterBottom>
                    {project.name}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {`BPM: ${project.bpm}, Key: ${project.key_signature}`}
                  </Typography>
                  
                  <Divider className="project-divider" />
                  
                  <Box className="project-metadata">
                    <Typography variant="body2">
                      BPM: {project.bpm}
                    </Typography>
                    <Typography variant="body2">
                      Key: {project.key_signature}
                    </Typography>
                  </Box>
                </CardContent>
                
                <Box className="project-card-actions">
                  <Button 
                    size="small" 
                    onClick={() => openProject(project.id)}
                    sx={{ flexGrow: 1, mr: 1 }}
                  >
                    Open
                  </Button>
                  <IconButton 
                    size="small" 
                    onClick={() => navigate({ 
                      to: '/studio',
                      search: { projectId: project.id } as any
                    })} 
                    aria-label="edit"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteProject(project.id)} 
                    aria-label="delete"
                  >
                    <IconTrashFilled size={18} />
                  </IconButton>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Show More Button */} 
      {!loading && displayedProjectsCount < totalProjectsOnServer && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
          <Button 
            variant="outlined"
            onClick={handleShowMore} 
            disabled={loadingMore}
          >
            Show More
          </Button>
        </Box>
      )}

      {/* Project Dialog removed - users go directly to studio page */}

      {/* My Sounds Section */}
      <Box sx={{ mt: 6, mb: 3 }}>
        <Box className="project-header">
          <Typography variant="h3" component="h1" sx={{ color: 'text.primary' }}>
            Audio Tracks
          </Typography>
          {/* <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setShowSoundUploader(true)}
          >
            Upload Sound
          </Button> */}
        </Box>

        {/* {showSoundUploader && (
          <Box sx={{ mt: 2, mb: 3 }}>
            <SoundUploader
              onSoundUploaded={(soundId) => {
                setShowSoundUploader(false);
                fetchSounds();
                showSnackbar('Sound uploaded successfully', 'success');
              }}
              onCancel={() => setShowSoundUploader(false)}
            />
          </Box>
        )} */}

        <SoundLibrary onReload={fetchSounds} />
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbar.open} 
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
  );
}