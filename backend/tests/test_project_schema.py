import pytest
from app.schemas.project import ProjectBase, ProjectCreate, Project, ProjectUpdate

def test_project_base_schema():
    """Test that ProjectBase accepts time_signature_numerator and time_signature_denominator"""
    # Create a minimal valid project
    project = ProjectBase(
        name="Test Project",
        time_signature_numerator=3,
        time_signature_denominator=4
    )
    assert project.name == "Test Project"
    assert project.bpm == 120.0  # Default value
    assert project.time_signature_numerator == 3
    assert project.time_signature_denominator == 4

def test_project_create_schema():
    """Test ProjectCreate schema with time signature fields"""
    project = ProjectCreate(
        name="New Project",
        time_signature_numerator=6,
        time_signature_denominator=8
    )
    assert project.name == "New Project"
    assert project.time_signature_numerator == 6
    assert project.time_signature_denominator == 8

def test_project_update_schema():
    """Test ProjectUpdate schema with time signature fields"""
    update = ProjectUpdate(
        name="Updated Project",
        time_signature_numerator=2,
        time_signature_denominator=4
    )
    assert update.name == "Updated Project"
    assert update.time_signature_numerator == 2
    assert update.time_signature_denominator == 4