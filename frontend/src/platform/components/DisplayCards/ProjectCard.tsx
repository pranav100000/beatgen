import React from 'react';
import {
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Separator } from "../../../components/ui/separator";
import { Edit as EditIcon } from '@mui/icons-material';
import { IconTrashFilled } from '@tabler/icons-react';
import { Project } from '../../types/project';

interface ProjectCardProps {
  project: Project;
  onOpenProject: (projectId: string) => void;
  onEditProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpenProject,
  onEditProject,
  onDeleteProject,
}) => {
  return (
    <Card className="project-card w-full min-h-[220px] flex flex-col justify-between">
      <CardHeader>
        <CardTitle className="truncate">{project.name}</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <Separator className="my-2" />
        <div className="project-metadata flex justify-between items-center text-sm text-muted-foreground">
          <p>
            BPM: {project.bpm}
          </p>
          <p>
            Key: {project.key_signature}
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex items-center gap-2 p-4">
        <Button
          size="sm"
          onClick={() => onOpenProject(project.id!)}
          className="flex-grow"
        >
          Open
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => onDeleteProject(project.id!)} 
          aria-label="delete"
        >
          <IconTrashFilled size={18} />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;
