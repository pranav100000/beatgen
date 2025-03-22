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
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectCreateDto>({
    name: '',
    description: '',
    bpm: 120,
    time_signature: '4/4'
  });
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
    navigate('/new-project');
  };

  const handleEditProject = (project: Project) => {
    setDialogMode('edit');
    setCurrentProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      bpm: project.bpm,
      time_signature: project.time_signature
    });
    setOpenDialog(true);
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

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'bpm' ? parseInt(value, 10) : value
    });
  };

  const handleSubmit = async () => {
    try {
      if (dialogMode === 'create') {
        const newProject = await createProject(formData);
        setProjects([...projects, newProject]);
        showSnackbar('Project created successfully', 'success');
      } else if (dialogMode === 'edit' && currentProject) {
        const updatedProject = await updateProject(
          currentProject.id,
          formData as ProjectUpdateDto
        );
        setProjects(
          projects.map(p => (p.id === updatedProject.id ? updatedProject : p))
        );
        showSnackbar('Project updated successfully', 'success');
      }
      setOpenDialog(false);
    } catch (err) {
      console.error(`Error ${dialogMode === 'create' ? 'creating' : 'updating'} project:`, err);
      showSnackbar(`Failed to ${dialogMode === 'create' ? 'create' : 'update'} project`, 'error');
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

  const openProject = (projectId: string) => {
    // For now, just navigate to new project page
    navigate(`/new-project`);
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
          onClick={() => navigate('/new-project')}
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
            onClick={() => navigate('/new-project')}
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
                    {project.description || 'No description'}
                  </Typography>
                  
                  <Divider className="project-divider" />
                  
                  <Box className="project-metadata">
                    <Typography variant="body2">
                      BPM: {project.bpm}
                    </Typography>
                    <Typography variant="body2">
                      Time: {project.time_signature}
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
                    onClick={() => handleEditProject(project)} 
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

      {/* Project Dialog */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Create New Project' : 'Edit Project'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Project Name"
            type="text"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            required
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            name="description"
            label="Description"
            type="text"
            fullWidth
            value={formData.description}
            onChange={handleInputChange}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              margin="dense"
              name="bpm"
              label="BPM"
              type="number"
              value={formData.bpm}
              onChange={handleInputChange}
              sx={{ mb: 2, width: '50%' }}
              InputProps={{
                inputProps: {
                  min: 40,
                  max: 300
                }
              }}
            />
            <TextField
              margin="dense"
              name="time_signature"
              label="Time Signature"
              type="text"
              value={formData.time_signature}
              onChange={handleInputChange}
              sx={{ mb: 2, width: '50%' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={!formData.name.trim()}
          >
            {dialogMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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