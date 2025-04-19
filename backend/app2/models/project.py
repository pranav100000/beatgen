"""
Project models for SQL database
"""
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import uuid

from app2.models.base import ProjectBase
from .project_track import ProjectTrack, ProjectTrackRead
from app2.models.track import TrackRead

# Handle circular imports
if TYPE_CHECKING:
    from app2.models.user import User
    from app2.models.track import Track
    from app2.models.project_track import ProjectTrack, ProjectTrackRead

# Database model
class Project(ProjectBase, table=True):
    """Project model for the database"""
    __tablename__ = "projects"
    
    # Relationships
    user_id: uuid.UUID = Field(foreign_key="users.id")
    user: Optional["User"] = Relationship(back_populates="projects")
    # Many-to-many relationship with Track via ProjectTrack
    tracks: List["Track"] = Relationship(back_populates="projects", link_model=ProjectTrack)
    # Direct relationship to ProjectTrack entries
    project_tracks: List["ProjectTrack"] = Relationship(back_populates="project")

# API Models
class ProjectRead(ProjectBase):
    """API response model for project data"""
    user_id: uuid.UUID

class ProjectCreate(ProjectBase):
    """API request model for creating a project"""
    user_id: uuid.UUID

class ProjectUpdate(ProjectBase):
    """API request model for updating a project"""
    tracks: Optional[List[ProjectTrack]] = None

# Projects with tracks included
class ProjectWithTracks(ProjectBase):
    """API response model for project with tracks data"""
    user_id: uuid.UUID
    # Keep the API fields here
    project_tracks: List[ProjectTrackRead] = Field(default_factory=list)
    tracks: List[TrackRead] = Field(default_factory=list)