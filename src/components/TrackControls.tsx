import { Box, IconButton, Slider } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import MicIcon from "@mui/icons-material/Mic";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { GRID_CONSTANTS } from "../constants/gridConstants";
import { useState, useRef } from "react";

interface TrackControlsProps {
  index: number;
  onDelete: (index: number) => void;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  name: string;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
  onMute: (muted: boolean) => void;
  onSolo: (soloed: boolean) => void;
  onNameChange: (name: string) => void;
}

function TrackControls({
  index,
  onDelete,
  volume,
  pan,
  muted,
  soloed,
  name,
  onVolumeChange,
  onPanChange,
  onMute,
  onSolo,
  onNameChange
}: TrackControlsProps) {
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddAudio = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && audioFiles.length < 4) {
      const newFiles = Array.from(files).slice(0, 4 - audioFiles.length); // Limit to 4 files
      setAudioFiles([...audioFiles, ...newFiles]);
    }
  };

  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleColour = () => {
  }

  return (
    <Box
      sx={{
        position: "relative",
        "&:not(:last-child)": {
          borderBottom: `1px solid ${GRID_CONSTANTS.borderColor}`,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          bgcolor: "#1A1A1A",
          p: 0.5,
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            gap: 1,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#666",
                width: "100%",
                fontSize: "0.85rem",
              }}
            />
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <IconButton
                size="small"
                sx={{
                  color: muted ? "#ff4444" : "#666",
                  padding: 0.5,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
                onClick={() => onMute(!muted)}
              >
                <VolumeUpIcon sx={{ fontSize: "small" }} />
              </IconButton>
              <IconButton
                size="small"
                sx={{
                  color: soloed ? "#44ff44" : "#666",
                  padding: 0.5,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
                onClick={() => onSolo(!soloed)}
              >
                <MicIcon sx={{ fontSize: "small" }} />
              </IconButton>
              <IconButton
                size="small"
                sx={{
                  color: "#666",
                  padding: 0.5,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
                onClick={() => onDelete(index)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>

              <IconButton
                size="small"
                sx={{
                  color: audioFiles.length > 0 ? "#44ff44" : "#666",
                  padding: 0.5,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                }}
                onClick={handleOpenFileDialog}
                disabled={audioFiles.length >= 4}
              >
                <AddIcon sx={{ fontSize: "medium" }} />
              </IconButton>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="audio/*"
                multiple
                onChange={handleAddAudio}
              />
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Box
              sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}
            >
              <Slider
                size="small"
                value={volume}
                onChange={(_, value) => onVolumeChange(value as number)}
                min={-60}
                max={6}
                sx={{
                  py: 0,
                  "& .MuiSlider-thumb": {
                    width: 12,
                    height: 12,
                  },
                }}
              />
              <Slider
                size="small"
                value={pan}
                onChange={(_, value) => onPanChange(value as number)}
                min={-1}
                max={1}
                step={0.1}
                sx={{
                  py: 0,
                  "& .MuiSlider-thumb": {
                    width: 12,
                    height: 12,
                  },
                }}
              />

              {/* Audio files displayed in a row */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 1,
                  mt: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {audioFiles.map((file, index) => (
                  <Box
                    onClick={handleColour}
                    key={index}
                    sx={{
                      padding: "6px 10px",
                      bgcolor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "6px",
                      fontSize: "14px",
                      textAlign: "center",
                      minWidth: "30px",
                      cursor: "pointer",
                    }}
                  >
                    {file.name.length > 4 ? file.name.substring(0, 6) + "..." : file.name}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default TrackControls;