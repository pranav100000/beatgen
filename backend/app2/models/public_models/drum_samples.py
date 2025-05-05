import uuid

from sqlmodel import Field, SQLModel
from app2.models.base import DrumSamplePublicBase, all_optional


class DrumSamplePublic(DrumSamplePublicBase, table=True):
    """Drum sample model"""

    __tablename__ = "drum_samples_public"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class DrumSamplePublicCreate(DrumSamplePublicBase):
    """Drum sample create model"""

    pass


class DrumSamplePublicRead(DrumSamplePublicBase):
    """Drum sample read model"""

    id: uuid.UUID


class DrumSamplePublicUpdate(
    all_optional(DrumSamplePublicBase, "DrumSamplePublicUpdate")
):
    """Drum sample update model"""

    id: uuid.UUID
    pass


class DrumSamplePublicDelete(SQLModel):
    """Drum sample delete model"""

    id: uuid.UUID
    pass
