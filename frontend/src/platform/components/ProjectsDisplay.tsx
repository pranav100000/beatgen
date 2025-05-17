import React from 'react';
import { 
  Typography, 
  Grid, 
  CircularProgress,
  Box,
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  Add as AddIcon,
  MusicNote as MusicNoteIcon,
} from '@mui/icons-material';
import { Project } from '../types/project';
import { Button } from "../../components/ui/button";
import ProjectCard from './DisplayCards/ProjectCard';
import { logoColors } from './Sidebar';

interface ProjectsDisplayProps {
  allFetchedProjects: Project[];
  displayedProjectsCount: number;
  totalProjectsOnServer: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onCreateNewProject: () => void;
  onOpenProject: (projectId: string) => void;
  onEditProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onShowMore: () => void;
  snackbarOpen: boolean;
  snackbarMessage: string;
  snackbarSeverity: 'success' | 'error';
  onCloseSnackbar: () => void;
  sectionColor: string;
}

const ProjectsDisplay: React.FC<ProjectsDisplayProps> = ({
  allFetchedProjects,
  displayedProjectsCount,
  totalProjectsOnServer,
  loading,
  loadingMore,
  error,
  onCreateNewProject,
  onOpenProject,
  onEditProject,
  onDeleteProject,
  onShowMore,
  snackbarOpen,
  snackbarMessage,
  snackbarSeverity,
  onCloseSnackbar,
  sectionColor,
}) => {
  return (
    <React.Fragment>
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Paper className="project-empty-state" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, mt: 2 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading your projects...
          </Typography>
        </Paper>
      ) : allFetchedProjects.length === 0 ? (
        <Paper className="project-empty-state" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, mt: 2, textAlign: 'center' }}>
          <MusicNoteIcon className="project-empty-icon" sx={{ fontSize: 60, mb: 2 }} />
          <Typography 
            variant="h6" 
            gutterBottom
            style={{ 
              color: logoColors[1],
              textShadow: `0 0 5px ${logoColors[1]}`
            }}
          >
            No projects yet
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Create your first music project to get started!
          </Typography>
          <Button 
            variant="default"
            className="flex items-center gap-2"
            onClick={onCreateNewProject}
          >
            <AddIcon fontSize="small" />
            Create Project
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{pt: 2}}>
          {allFetchedProjects.slice(0, displayedProjectsCount).map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <ProjectCard 
                project={project}
                onOpenProject={onOpenProject}
                onEditProject={onEditProject}
                onDeleteProject={onDeleteProject}
                sectionColor={sectionColor}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Show More Button */} 
      {!loading && displayedProjectsCount < totalProjectsOnServer && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
          <Button 
            variant="outline"
            onClick={onShowMore} 
            disabled={loadingMore}
          >
            Show More
          </Button>
        </Box>
      )}

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={onCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={onCloseSnackbar} 
          severity={snackbarSeverity} 
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </React.Fragment>
  );
};

export default ProjectsDisplay;
