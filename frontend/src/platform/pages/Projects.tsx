import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { 
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
import { useAuth } from '../auth/auth-context';
import { 
  getProjects, 
  deleteProject, 
} from '../api/projects';
import { Project } from '../types/project';
import Sidebar from '../components/Sidebar';
import { useSidebar } from "@/components/ui/sidebar";
import ProjectsDisplay from '../components/ProjectsDisplay';


// Constants for pagination and display
const INITIAL_DISPLAY_COUNT = 12;
const DISPLAY_INCREMENT = 6; // How many more to show on each click (relevant later)
const FETCH_THRESHOLD = 10; // When to fetch more from API (relevant later)
const PROJECTS_PER_PAGE_API = 20; // How many to fetch from API at a time

export default function Projects() {
  const navigate = useNavigate();
  const { open: sidebarActualOpen } = useSidebar();

  const [allFetchedProjects, setAllFetchedProjects] = useState<Project[]>([]);
  const [displayedProjectsCount, setDisplayedProjectsCount] = useState<number>(INITIAL_DISPLAY_COUNT);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalProjectsOnServer, setTotalProjectsOnServer] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  
  const fetchSounds = () => {
    console.log('Refreshing sounds library');
  };

  const fetchAndSetInitialProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProjects(1, PROJECTS_PER_PAGE_API);
      setAllFetchedProjects(response.items);
      setTotalProjectsOnServer(response.total_items);
      const initialDisplay = Math.min(INITIAL_DISPLAY_COUNT, response.items.length);
      setDisplayedProjectsCount(initialDisplay);
      setCurrentPage(1);
      console.log("Initial fetch complete. States after initial set:");
      console.log("displayedProjectsCount:", initialDisplay);
      console.log("totalProjectsOnServer:", response.total_items);
      console.log("allFetchedProjects.length:", response.items.length);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again later.');
    } finally {
      setLoading(false);
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
      setTotalProjectsOnServer(response.total_items); 
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Error fetching more projects:', err);
      setError('Failed to load more projects.');
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
    const remainingInBatch = allFetchedProjects.length - newDisplayedCount;
    const hasMoreOnServer = allFetchedProjects.length < totalProjectsOnServer;
    if (remainingInBatch < FETCH_THRESHOLD && hasMoreOnServer && !loadingMore) {
      fetchMoreProjects();
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

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        await fetchAndSetInitialProjects();
        showSnackbar('Project deleted successfully', 'success');
      } catch (err) {
        console.error('Error deleting project:', err);
        showSnackbar('Failed to delete project', 'error');
      }
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
        <ProjectsDisplay
          allFetchedProjects={allFetchedProjects}
          displayedProjectsCount={displayedProjectsCount}
          totalProjectsOnServer={totalProjectsOnServer}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onCreateNewProject={handleCreateProject}
          onOpenProject={openProject}
          onEditProject={navigateToEditProject} 
          onDeleteProject={handleDeleteProject}
          onShowMore={handleShowMore}
          snackbarOpen={snackbar.open}
          snackbarMessage={snackbar.message}
          snackbarSeverity={snackbar.severity}
          onCloseSnackbar={handleCloseSnackbar}
        />
      </main>
    </Box>
  );
}