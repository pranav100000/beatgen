"""
Link table model for the many-to-many relationship between Projects and Tracks
"""
from typing import Optional, TYPE_CHECKING
import uuid # Removed List, datetime, uuid
from sqlmodel import SQLModel, Field, Relationship

from app2.models.base import ProjectTrackBase # Added Relationship if needed later
# Removed imports for TrackRead, TimestampMixin, UUIDModel, User

# Note: We assume Project and Track models use INT primary keys named 'id'
# as per the SQL schema provided. If they use UUIDs, adjust the type hints
# and foreign_key references accordingly.

# Handle circular imports
if TYPE_CHECKING:
    from .project import Project  # Uncommented and adjusted path
    from .track import Track    # Uncommented and adjusted path

# Database model
# Removed UUIDModel, TimestampMixin inheritance
class ProjectTrack(ProjectTrackBase, table=True):
    """
    Represents the association between a Project and a Track,
    storing properties specific to this relationship (e.g., position, volume).
    """
    __tablename__ = "project_tracks"
    
    # Composite Primary Key and Foreign Keys
    project_id: uuid.UUID = Field( # Changed type to int
        default=None, # Required for composite key definition
        foreign_key="projects.id", 
        primary_key=True
    )
    track_id: uuid.UUID = Field( # Changed type to int
        default=None, # Required for composite key definition
        foreign_key="tracks.id", 
        primary_key=True
    )

    # Additional properties specific to the project-track link
    
    # Removed fields: pan, mute, x_position, y_position, trim_start_ticks, 
    # trim_end_ticks, duration_ticks, track_number, user_id, user, tracks

    # --- Relationships ---
    # Relationships with back_populates
    project: Optional["Project"] = Relationship(back_populates="project_tracks")
    track: Optional["Track"] = Relationship(back_populates="project_tracks")

# Create model that inherits the base and adds the specific fields
class ProjectTrackDTO(ProjectTrackBase):
    pass

class ProjectTrackCreate(ProjectTrackDTO):
    pass
    
class ProjectTrackRead(ProjectTrackDTO):
    pass # Keep simple for now, can add nested TrackRead later if needed

class ProjectTrackUpdate(ProjectTrackDTO):
    pass # Allow updating project_id/track_id doesn't make sense usually
