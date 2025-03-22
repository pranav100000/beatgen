import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Button, 
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
import '../styles/Projects.css';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon, 
  MusicNote as MusicNoteIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAuth } from '../core/auth/auth-context';
import { 
  getProjects, 
  deleteProject, 
  createProject, 
  updateProject, 
  Project, 
  ProjectCreateDto, 
  ProjectUpdateDto 
} from '../api/projects';

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // No dialog state needed anymore
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
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    navigate('/studio');
  };

  const handleEditProject = (project: Project) => {
    // Navigate directly to studio with project ID
    navigate(`/studio?projectId=${project.id}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        setProjects(projects.filter(p => p.id !== projectId));
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
    // In a real implementation, you would load this project
    // Either:
    // 1. Navigate to studio with query parameter: /studio?projectId=xyz
    // 2. Or to a specific edit route: /project/xyz
    
    // For now, just navigate to studio page with ID as query param
    navigate(`/studio?projectId=${projectId}`);
  };

  // We'll keep the page loaded and only show a spinner in the projects area

  return (
    <Container maxWidth="lg" className="projects-container">
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
      >
        Back to Home
      </Button>
      <Box className="project-header">
        <Typography variant="h4" component="h1">
          My Projects
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/studio')}
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
      ) : projects.length === 0 ? (
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
            onClick={() => navigate('/studio')}
          >
            Create Project
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card className="project-card">
                <CardContent className="project-card-content">
                  <Typography variant="h6" component="h2" gutterBottom>
                    {project.name}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {`BPM: ${project.bpm}, Time: ${project.time_signature_numerator}/${project.time_signature_denominator}`}
                  </Typography>
                  
                  <Divider className="project-divider" />
                  
                  <Box className="project-metadata">
                    <Typography variant="body2">
                      BPM: {project.bpm}
                    </Typography>
                    <Typography variant="body2">
                      Time: {project.time_signature_numerator}/{project.time_signature_denominator}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Tracks: {project.tracks.length}
                  </Typography>
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
                    onClick={() => navigate(`/studio?projectId=${project.id}`)} 
                    aria-label="edit"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteProject(project.id)} 
                    aria-label="delete"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Project Dialog removed - users go directly to studio page */}

      {/* My Sounds Section */}
      <Box sx={{ mt: 6, mb: 3 }}>
        <Box className="project-header">
          <Typography variant="h4" component="h1">
            My Sounds
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => console.log('Upload sound clicked')}
          >
            Upload Sound
          </Button>
        </Box>

        <Paper 
          sx={{ 
            p: 3, 
            mt: 2, 
            bgcolor: '#1A1A1A', 
            color: 'white',
            border: '1px solid #333'
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            py: 4
          }}>
            <MusicNoteIcon sx={{ fontSize: 60, color: '#666', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No sounds uploaded yet
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph align="center">
              Upload audio files that you can use in your projects.<br />
              Supported formats: MP3, WAV, AIFF
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => console.log('Upload sound clicked')}
              sx={{ mt: 2 }}
            >
              Upload Your First Sound
            </Button>
          </Box>
        </Paper>
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