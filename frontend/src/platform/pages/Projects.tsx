import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { 
  Container,
  Typography, 
  Box,
  Alert,
  Snackbar
} from '@mui/material';
import './styles/Projects.css';
import { 
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { 
  getProjects, 
  deleteProject, 
} from '../api/projects';
import { Project } from '../types/project';
import Sidebar from '../components/Sidebar';
import { useSidebar } from "@/components/ui/sidebar";
import ProjectsDisplay from '../components/ProjectsDisplay';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Page } from '../types/pagination';

// Constants for pagination and display
const INITIAL_DISPLAY_COUNT = 12;
const DISPLAY_INCREMENT = 6;
const PROJECTS_PER_PAGE_API = 20;

export default function Projects() {
  const navigate = useNavigate();
  const { open: sidebarActualOpen } = useSidebar();
  const queryClient = useQueryClient();

  const [displayedProjectsCount, setDisplayedProjectsCount] = useState<number>(INITIAL_DISPLAY_COUNT);
  const [currentPageApi, setCurrentPageApi] = useState<number>(1);

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
  const totalPagesApi = projectsData?.total_pages ?? 0;

  useEffect(() => {
    if (projectsData?.items) {
      if (currentPageApi === 1) {
        setDisplayedProjectsCount(Math.min(INITIAL_DISPLAY_COUNT, projectsData.items.length));
      } else {
        setDisplayedProjectsCount(prevCount => Math.min(prevCount, allFetchedProjects.length));
      }
    }
  }, [projectsData?.items, currentPageApi, allFetchedProjects.length]);

  const handleShowMore = () => {
    const newDisplayedCount = Math.min(
      displayedProjectsCount + DISPLAY_INCREMENT,
      allFetchedProjects.length
    );
    setDisplayedProjectsCount(newDisplayedCount);

    if (newDisplayedCount >= allFetchedProjects.length && allFetchedProjects.length < totalProjectsOnServer && !isFetchingProjects) {
      if (currentPageApi < totalPagesApi) {
        setCurrentPageApi(prev => prev + 1);
      }
    }
  };

  const handleCreateProject = () => {
    navigate({ to: '/studio' });
  };

  const navigateToEditProject = (projectId: string) => {
    navigate({ 
      to: '/studio',
      search: { projectId } as any
    });
  };

  const { mutate: performDeleteProject, isPending: isDeletingProject } = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      showSnackbar('Project deleted successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: Error) => {
      console.error('Error deleting project:', err);
      showSnackbar(`Failed to delete project: ${err.message}`, 'error');
    },
  });

  const handleDeleteProject = async (projectId: string) => {
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

  const openProject = (projectId: string) => {
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
          padding: '2rem',
        }}
      >
        <Container maxWidth="lg" sx={{ pt: 0, mt: 0 }}>
          {projectsError && !projectsData && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {projectsError.message || 'Failed to load projects. Please try again later.'}
            </Alert>
          )}
          <ProjectsDisplay
            allFetchedProjects={allFetchedProjects}
            displayedProjectsCount={displayedProjectsCount}
            totalProjectsOnServer={totalProjectsOnServer}
            loading={loadingProjects && currentPageApi === 1}
            loadingMore={isFetchingProjects && currentPageApi > 1}
            error={projectsError ? projectsError.message : null}
            onCreateNewProject={handleCreateProject}
            onOpenProject={openProject}
            onEditProject={navigateToEditProject}
            onDeleteProject={handleDeleteProject}
            onShowMore={handleShowMore}
            snackbarOpen={snackbar.open}
            snackbarMessage={snackbar.message}
            snackbarSeverity={snackbar.severity}
            onCloseSnackbar={handleCloseSnackbar} 
            sectionColor={''}          />
        </Container>
      </main>
    </Box>
  );
}