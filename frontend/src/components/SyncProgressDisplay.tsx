import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Fade,
  Card,
  CardContent,
  Stack,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Speed as SpeedIcon,
  Folder as FolderIcon,
  TextSnippet as FileIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Timer as TimerIcon,
  Sync as SyncIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { SyncProgressInfo } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { useSyncProgressWebSocket, ConnectionStatus } from '../hooks/useSyncProgressWebSocket';

interface SyncProgressDisplayProps {
  sourceId: string;
  sourceName: string;
  isVisible: boolean;
  onClose?: () => void;
}

export const SyncProgressDisplay: React.FC<SyncProgressDisplayProps> = ({
  sourceId,
  sourceName,
  isVisible,
  onClose,
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  // Handle WebSocket connection errors
  const handleWebSocketError = useCallback((error: any) => {
    console.error('WebSocket connection error in SyncProgressDisplay:', error);
  }, []);

  // Handle connection status changes
  const handleConnectionStatusChange = useCallback((status: ConnectionStatus) => {
    console.log(`Connection status changed to: ${status}`);
  }, []);

  // Use the WebSocket hook for sync progress updates
  const {
    progressInfo,
    connectionStatus,
    isConnected,
    reconnect,
    disconnect,
  } = useSyncProgressWebSocket({
    sourceId,
    enabled: isVisible && !!sourceId,
    onError: handleWebSocketError,
    onConnectionStatusChange: handleConnectionStatusChange,
  });


  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'initializing':
      case 'evaluating':
        return theme.palette.info.main;
      case 'discovering_directories':
      case 'discovering_files':
        return theme.palette.warning.main;
      case 'processing_files':
        return theme.palette.primary.main;
      case 'saving_metadata':
        return theme.palette.secondary.main;
      case 'completed':
        return theme.palette.success.main;
      case 'failed':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'discovering_directories':
        return <FolderIcon />;
      case 'discovering_files':
      case 'processing_files':
        return <FileIcon />;
      case 'saving_metadata':
        return <StorageIcon />;
      case 'completed':
        return <CheckCircleIcon />;
      case 'failed':
        return <ErrorIcon />;
      default:
        return <SpeedIcon />;
    }
  };

  if (!isVisible || (!progressInfo && connectionStatus === 'disconnected' && !isConnected)) {
    return null;
  }

  return (
    <Card
      sx={{
        mb: 2,
        border: progressInfo?.is_active ? `2px solid ${getPhaseColor(progressInfo.phase)}` : '1px solid',
        borderColor: progressInfo?.is_active ? getPhaseColor(progressInfo.phase) : theme.palette.divider,
        backgroundColor: progressInfo?.is_active 
          ? alpha(getPhaseColor(progressInfo.phase), 0.05)
          : theme.palette.background.paper,
      }}
    >
      <CardContent sx={{ pb: isExpanded ? 2 : '16px !important' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={isExpanded ? 2 : 0}>
          <Box display="flex" alignItems="center" gap={2}>
            {progressInfo && (
              <Box
                sx={{
                  color: getPhaseColor(progressInfo.phase),
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {getPhaseIcon(progressInfo.phase)}
              </Box>
            )}
            <Box>
              <Typography variant="h6" component="div">
                {sourceName} - Sync Progress
              </Typography>
              {progressInfo && (
                <Typography variant="body2" color="text.secondary">
                  {progressInfo.phase_description}
                </Typography>
              )}
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {connectionStatus === 'connecting' && (
              <Chip size="small" label="Connecting..." color="warning" />
            )}
            {connectionStatus === 'reconnecting' && (
              <Chip size="small" label="Reconnecting..." color="warning" />
            )}
            {connectionStatus === 'connected' && progressInfo?.is_active && (
              <Chip size="small" label="Live" color="success" />
            )}
            {connectionStatus === 'connected' && !progressInfo?.is_active && (
              <Chip size="small" label="Connected" color="info" />
            )}
            {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
              <Chip size="small" label="Disconnected" color="error" />
            )}
            {connectionStatus === 'failed' && (
              <Chip size="small" label="Connection Failed" color="error" />
            )}
            
            {/* Add manual reconnect button for failed connections */}
            {(connectionStatus === 'failed' || connectionStatus === 'error') && (
              <Tooltip title="Reconnect">
                <IconButton 
                  onClick={reconnect}
                  size="small"
                  color="primary"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title={isExpanded ? "Collapse" : "Expand"}>
              <IconButton 
                onClick={() => setIsExpanded(!isExpanded)}
                size="small"
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Collapse in={isExpanded}>
          {progressInfo ? (
            <Stack spacing={2}>
              {/* Progress Bar */}
              {progressInfo.files_found > 0 && (
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Files Progress
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {progressInfo.files_processed} / {progressInfo.files_found} files ({progressInfo.files_progress_percent.toFixed(1)}%)
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={progressInfo.files_progress_percent}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: alpha(getPhaseColor(progressInfo.phase), 0.2),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getPhaseColor(progressInfo.phase),
                      },
                    }}
                  />
                </Box>
              )}

              {/* Statistics Grid */}
              <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Directories
                  </Typography>
                  <Typography variant="h6">
                    {progressInfo.directories_processed} / {progressInfo.directories_found}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Data Processed
                  </Typography>
                  <Typography variant="h6">
                    {formatBytes(progressInfo.bytes_processed)}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Processing Rate
                  </Typography>
                  <Typography variant="h6">
                    {progressInfo.processing_rate_files_per_sec.toFixed(1)} files/sec
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Elapsed Time
                  </Typography>
                  <Typography variant="h6">
                    {formatDuration(progressInfo.elapsed_time_secs)}
                  </Typography>
                </Box>
              </Box>

              {/* Estimated Time Remaining */}
              {progressInfo.estimated_time_remaining_secs && progressInfo.estimated_time_remaining_secs > 0 && (
                <Box display="flex" alignItems="center" gap={1}>
                  <TimerIcon color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Estimated time remaining: {formatDuration(progressInfo.estimated_time_remaining_secs)}
                  </Typography>
                </Box>
              )}

              {/* Current Operations */}
              {progressInfo.current_directory && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Current Directory
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {progressInfo.current_directory}
                  </Typography>
                  {progressInfo.current_file && (
                    <>
                      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 1 }}>
                        Current File
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {progressInfo.current_file}
                      </Typography>
                    </>
                  )}
                </Box>
              )}

              {/* Errors and Warnings */}
              {(progressInfo.errors > 0 || progressInfo.warnings > 0) && (
                <Box display="flex" gap={2}>
                  {progressInfo.errors > 0 && (
                    <Chip
                      icon={<ErrorIcon />}
                      label={`${progressInfo.errors} error${progressInfo.errors !== 1 ? 's' : ''}`}
                      color="error"
                      size="small"
                    />
                  )}
                  {progressInfo.warnings > 0 && (
                    <Chip
                      icon={<WarningIcon />}
                      label={`${progressInfo.warnings} warning${progressInfo.warnings !== 1 ? 's' : ''}`}
                      color="warning"
                      size="small"
                    />
                  )}
                </Box>
              )}
            </Stack>
          ) : (
            <Alert severity="info">
              Waiting for sync progress information...
            </Alert>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SyncProgressDisplay;