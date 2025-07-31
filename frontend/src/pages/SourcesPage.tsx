import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Snackbar,
  Divider,
  FormControlLabel,
  Switch,
  Tooltip,
  CircularProgress,
  Fade,
  Stack,
  Avatar,
  Badge,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import {
  Add as AddIcon,
  CloudSync as CloudSyncIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  AutoFixHigh as AutoFixHighIcon,
  Sync as SyncIcon,
  MoreVert as MoreVertIcon,
  Menu as MenuIcon,
  Speed as QuickSyncIcon,
  ManageSearch as DeepScanIcon,
  Folder as FolderIcon,
  Assessment as AssessmentIcon,
  Extension as ExtensionIcon,
  Storage as ServerIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  TextSnippet as DocumentIcon,
  Visibility as OcrIcon,
  Block as BlockIcon,
  HealthAndSafety as HealthIcon,
  Warning as WarningIcon,
  Error as CriticalIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api, { queueService, sourcesService, ErrorHelper, ErrorCodes } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import SyncProgressDisplay from '../components/SyncProgress';

interface Source {
  id: string;
  name: string;
  source_type: 'webdav' | 'local_folder' | 's3';
  enabled: boolean;
  config: any;
  status: 'idle' | 'syncing' | 'error';
  last_sync_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  total_files_synced: number;
  total_files_pending: number;
  total_size_bytes: number;
  total_documents: number;
  total_documents_ocr: number;
  created_at: string;
  updated_at: string;
  // Validation fields
  validation_status?: string | null;
  last_validation_at?: string | null;
  validation_score?: number | null;
  validation_issues?: string | null;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

const SourcesPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocrStatus, setOcrStatus] = useState<{ is_paused: boolean; status: string }>({ is_paused: false, status: 'running' });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    source_type: 'webdav' as 'webdav' | 'local_folder' | 's3',
    enabled: true,
    // WebDAV fields
    server_url: '',
    username: '',
    password: '',
    server_type: 'generic' as 'nextcloud' | 'owncloud' | 'generic',
    // Local Folder fields
    recursive: true,
    follow_symlinks: false,
    // S3 fields
    bucket_name: '',
    region: 'us-east-1',
    access_key_id: '',
    secret_access_key: '',
    endpoint_url: '',
    prefix: '',
    // Common fields
    watch_folders: ['/Documents'],
    file_extensions: ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'txt'],
    auto_sync: false,
    sync_interval_minutes: 60,
  });

  // Additional state for enhanced features
  const [newFolder, setNewFolder] = useState('');
  const [newExtension, setNewExtension] = useState('');
  const [crawlEstimate, setCrawlEstimate] = useState<any>(null);
  const [estimatingCrawl, setEstimatingCrawl] = useState(false);

  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [stoppingSync, setStoppingSync] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  
  // Sync modal state
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [sourceToSync, setSourceToSync] = useState<Source | null>(null);
  const [deepScanning, setDeepScanning] = useState(false);

  useEffect(() => {
    loadSources();
    if (user?.role === 'Admin') {
      loadOcrStatus();
    }
  }, [user]);

  // Auto-refresh sources when any source is syncing
  useEffect(() => {
    const activeSyncingSources = sources.filter(source => source.status === 'syncing');
    
    if (activeSyncingSources.length > 0) {
      setAutoRefreshing(true);
      const interval = setInterval(() => {
        loadSources();
      }, 5000); // Poll every 5 seconds during active sync
      
      return () => {
        clearInterval(interval);
        setAutoRefreshing(false);
      };
    } else {
      setAutoRefreshing(false);
    }
  }, [sources]);

  // Update default folders when source type changes
  useEffect(() => {
    if (!editingSource) { // Only for new sources
      let defaultFolders;
      switch (formData.source_type) {
        case 'local_folder':
          defaultFolders = ['/home/user/Documents'];
          break;
        case 's3':
          defaultFolders = ['documents/'];
          break;
        case 'webdav':
        default:
          defaultFolders = ['/Documents'];
          break;
      }
      setFormData(prev => ({ ...prev, watch_folders: defaultFolders }));
    }
  }, [formData.source_type, editingSource]);

  const loadSources = async () => {
    try {
      const response = await api.get('/sources');
      setSources(response.data);
    } catch (error) {
      console.error('Failed to load sources:', error);
      showSnackbar('Failed to load sources', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: SnackbarState['severity']) => {
    setSnackbar({ open: true, message, severity });
  };

  // OCR Control Functions (Admin only)
  const loadOcrStatus = async () => {
    if (user?.role !== 'Admin') return;
    try {
      const response = await queueService.getOcrStatus();
      setOcrStatus(response.data);
    } catch (error) {
      console.error('Failed to load OCR status:', error);
    }
  };

  const handlePauseOcr = async () => {
    if (user?.role !== 'Admin') return;
    setOcrLoading(true);
    try {
      await queueService.pauseOcr();
      await loadOcrStatus();
      showSnackbar('OCR processing paused successfully', 'success');
    } catch (error) {
      console.error('Failed to pause OCR:', error);
      showSnackbar('Failed to pause OCR processing', 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleResumeOcr = async () => {
    if (user?.role !== 'Admin') return;
    setOcrLoading(true);
    try {
      await queueService.resumeOcr();
      await loadOcrStatus();
      showSnackbar('OCR processing resumed successfully', 'success');
    } catch (error) {
      console.error('Failed to resume OCR:', error);
      showSnackbar('Failed to resume OCR processing', 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCreateSource = () => {
    setEditingSource(null);
    setFormData({
      name: '',
      source_type: 'webdav',
      enabled: true,
      // WebDAV fields
      server_url: '',
      username: '',
      password: '',
      server_type: 'generic',
      // Local Folder fields
      recursive: true,
      follow_symlinks: false,
      // S3 fields
      bucket_name: '',
      region: 'us-east-1',
      access_key_id: '',
      secret_access_key: '',
      endpoint_url: '',
      prefix: '',
      // Common fields
      watch_folders: ['/Documents'],
      file_extensions: ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'txt'],
      auto_sync: false,
      sync_interval_minutes: 60,
    });
    setCrawlEstimate(null);
    setNewFolder('');
    setNewExtension('');
    setDialogOpen(true);
  };

  const handleEditSource = (source: Source) => {
    setEditingSource(source);
    const config = source.config;
    setFormData({
      name: source.name,
      source_type: source.source_type,
      enabled: source.enabled,
      // WebDAV fields
      server_url: config.server_url || '',
      username: config.username || '',
      password: config.password || '',
      server_type: config.server_type || 'generic',
      // Local Folder fields
      recursive: config.recursive !== undefined ? config.recursive : true,
      follow_symlinks: config.follow_symlinks || false,
      // S3 fields
      bucket_name: config.bucket_name || '',
      region: config.region || 'us-east-1',
      access_key_id: config.access_key_id || '',
      secret_access_key: config.secret_access_key || '',
      endpoint_url: config.endpoint_url || '',
      prefix: config.prefix || '',
      // Common fields
      watch_folders: config.watch_folders || ['/Documents'],
      file_extensions: config.file_extensions || ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'txt'],
      auto_sync: config.auto_sync || false,
      sync_interval_minutes: config.sync_interval_minutes || 60,
    });
    setCrawlEstimate(null);
    setNewFolder('');
    setNewExtension('');
    setDialogOpen(true);
  };

  const handleSaveSource = async () => {
    try {
      let config = {};
      
      // Build config based on source type
      if (formData.source_type === 'webdav') {
        config = {
          server_url: formData.server_url,
          username: formData.username,
          password: formData.password,
          watch_folders: formData.watch_folders,
          file_extensions: formData.file_extensions,
          auto_sync: formData.auto_sync,
          sync_interval_minutes: formData.sync_interval_minutes,
          server_type: formData.server_type,
        };
      } else if (formData.source_type === 'local_folder') {
        config = {
          watch_folders: formData.watch_folders,
          file_extensions: formData.file_extensions,
          auto_sync: formData.auto_sync,
          sync_interval_minutes: formData.sync_interval_minutes,
          recursive: formData.recursive,
          follow_symlinks: formData.follow_symlinks,
        };
      } else if (formData.source_type === 's3') {
        config = {
          bucket_name: formData.bucket_name,
          region: formData.region,
          access_key_id: formData.access_key_id,
          secret_access_key: formData.secret_access_key,
          endpoint_url: formData.endpoint_url,
          prefix: formData.prefix,
          watch_folders: formData.watch_folders,
          file_extensions: formData.file_extensions,
          auto_sync: formData.auto_sync,
          sync_interval_minutes: formData.sync_interval_minutes,
        };
      }

      if (editingSource) {
        await api.put(`/sources/${editingSource.id}`, {
          name: formData.name,
          enabled: formData.enabled,
          config,
        });
        showSnackbar('Source updated successfully', 'success');
      } else {
        await api.post('/sources', {
          name: formData.name,
          source_type: formData.source_type,
          enabled: formData.enabled,
          config,
        });
        showSnackbar('Source created successfully', 'success');
      }

      setDialogOpen(false);
      loadSources();
    } catch (error) {
      console.error('Failed to save source:', error);
      
      const errorInfo = ErrorHelper.formatErrorForDisplay(error, true);
      
      // Handle specific source errors
      if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_DUPLICATE_NAME)) {
        showSnackbar('A source with this name already exists. Please choose a different name.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_CONFIG_INVALID)) {
        showSnackbar('Source configuration is invalid. Please check your settings and try again.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_AUTH_FAILED)) {
        showSnackbar('Authentication failed. Please verify your credentials.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_CONNECTION_FAILED)) {
        showSnackbar('Cannot connect to the source. Please check your network and server settings.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_INVALID_PATH)) {
        showSnackbar('Invalid path specified. Please check your folder paths and try again.', 'error');
      } else {
        showSnackbar(errorInfo.message || 'Failed to save source', 'error');
      }
    }
  };

  const handleDeleteSource = (source: Source) => {
    setSourceToDelete(source);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSourceToDelete(null);
    setDeleteLoading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/sources/${sourceToDelete.id}`);
      showSnackbar('Source deleted successfully', 'success');
      loadSources();
      handleDeleteCancel();
    } catch (error) {
      console.error('Failed to delete source:', error);
      
      const errorInfo = ErrorHelper.formatErrorForDisplay(error, true);
      
      // Handle specific delete errors
      if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_NOT_FOUND)) {
        showSnackbar('Source not found. It may have already been deleted.', 'warning');
        loadSources(); // Refresh the list
        handleDeleteCancel();
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_SYNC_IN_PROGRESS)) {
        showSnackbar('Cannot delete source while sync is in progress. Please stop the sync first.', 'error');
      } else {
        showSnackbar(errorInfo.message || 'Failed to delete source', 'error');
      }
      setDeleteLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      let response;
      if (formData.source_type === 'webdav') {
        response = await api.post('/sources/test-connection', {
          source_type: 'webdav',
          config: {
            server_url: formData.server_url,
            username: formData.username,
            password: formData.password,
            server_type: formData.server_type,
            watch_folders: formData.watch_folders,
            file_extensions: formData.file_extensions,
          }
        });
      } else if (formData.source_type === 'local_folder') {
        response = await api.post('/sources/test-connection', {
          source_type: 'local_folder',
          config: {
            watch_folders: formData.watch_folders,
            file_extensions: formData.file_extensions,
            recursive: formData.recursive,
            follow_symlinks: formData.follow_symlinks,
          }
        });
      } else if (formData.source_type === 's3') {
        response = await api.post('/sources/test-connection', {
          source_type: 's3',
          config: {
            bucket_name: formData.bucket_name,
            region: formData.region,
            access_key_id: formData.access_key_id,
            secret_access_key: formData.secret_access_key,
            endpoint_url: formData.endpoint_url,
            prefix: formData.prefix,
          }
        });
      }

      if (response && response.data.success) {
        showSnackbar(response.data.message || 'Connection successful!', 'success');
      } else {
        showSnackbar(response?.data.message || 'Connection failed', 'error');
      }
    } catch (error: any) {
      console.error('Failed to test connection:', error);
      
      const errorInfo = ErrorHelper.formatErrorForDisplay(error, true);
      
      // Handle specific connection test errors
      if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_CONNECTION_FAILED)) {
        showSnackbar('Connection failed. Please check your server URL and network connectivity.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_AUTH_FAILED)) {
        showSnackbar('Authentication failed. Please verify your username and password.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_INVALID_PATH)) {
        showSnackbar('Invalid path specified. Please check your folder paths.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_CONFIG_INVALID)) {
        showSnackbar('Configuration is invalid. Please review your settings.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_NETWORK_TIMEOUT)) {
        showSnackbar('Connection timed out. Please check your network and try again.', 'error');
      } else {
        showSnackbar(errorInfo.message || 'Failed to test connection', 'error');
      }
    } finally {
      setTestingConnection(false);
    }
  };

  // Open sync modal instead of directly triggering sync
  const handleOpenSyncModal = (source: Source) => {
    setSourceToSync(source);
    setSyncModalOpen(true);
  };

  const handleCloseSyncModal = () => {
    setSyncModalOpen(false);
    setSourceToSync(null);
  };

  const handleQuickSync = async () => {
    if (!sourceToSync) return;
    
    setSyncingSource(sourceToSync.id);
    handleCloseSyncModal();
    
    try {
      await sourcesService.triggerSync(sourceToSync.id);
      showSnackbar('Quick sync started successfully', 'success');
      setTimeout(loadSources, 1000);
    } catch (error: any) {
      console.error('Failed to trigger sync:', error);
      
      const errorInfo = ErrorHelper.formatErrorForDisplay(error, true);
      
      // Handle specific sync errors
      if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_SYNC_IN_PROGRESS)) {
        showSnackbar('Source is already syncing. Please wait for the current sync to complete.', 'warning');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_CONNECTION_FAILED)) {
        showSnackbar('Cannot connect to source. Please check your connection and try again.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_AUTH_FAILED)) {
        showSnackbar('Authentication failed. Please verify your source credentials.', 'error');
      } else if (ErrorHelper.isErrorCode(error, ErrorCodes.SOURCE_NOT_FOUND)) {
        showSnackbar('Source not found. It may have been deleted.', 'error');
        loadSources(); // Refresh the sources list
      } else {
        showSnackbar(errorInfo.message || 'Failed to start sync', 'error');
      }
    } finally {
      setSyncingSource(null);
    }
  };

  const handleDeepScan = async () => {
    if (!sourceToSync) return;
    
    setDeepScanning(true);
    handleCloseSyncModal();
    
    try {
      await sourcesService.triggerDeepScan(sourceToSync.id);
      showSnackbar('Deep scan started successfully', 'success');
      setTimeout(loadSources, 1000);
    } catch (error: any) {
      console.error('Failed to trigger deep scan:', error);
      if (error.response?.status === 409) {
        showSnackbar('Source is already syncing', 'warning');
      } else if (error.response?.status === 400 && error.response?.data?.message?.includes('only supported for WebDAV')) {
        showSnackbar('Deep scan is only supported for WebDAV sources', 'warning');
      } else {
        showSnackbar('Failed to start deep scan', 'error');
      }
    } finally {
      setDeepScanning(false);
    }
  };

  const handleStopSync = async (sourceId: string) => {
    setStoppingSync(sourceId);
    try {
      await sourcesService.stopSync(sourceId);
      showSnackbar('Sync stopped successfully', 'success');
      setTimeout(loadSources, 1000);
    } catch (error: any) {
      console.error('Failed to stop sync:', error);
      if (error.response?.status === 409) {
        showSnackbar('Source is not currently syncing', 'warning');
      } else {
        showSnackbar('Failed to stop sync', 'error');
      }
    } finally {
      setStoppingSync(null);
    }
  };

  const handleValidation = async (sourceId: string) => {
    setValidating(sourceId);
    try {
      const response = await api.post(`/sources/${sourceId}/validate`);
      if (response.data.success) {
        showSnackbar(response.data.message || 'Validation check started successfully', 'success');
        setTimeout(loadSources, 2000); // Reload after 2 seconds to show updated status
      } else {
        showSnackbar(response.data.message || 'Failed to start validation check', 'error');
      }
    } catch (error: any) {
      console.error('Failed to trigger validation:', error);
      const message = error.response?.data?.message || 'Failed to start validation check';
      showSnackbar(message, 'error');
    } finally {
      setValidating(null);
    }
  };

  // Helper function to render validation status
  const renderValidationStatus = (source: Source) => {
    const validationStatus = source.validation_status;
    const validationScore = source.validation_score;
    const lastValidationAt = source.last_validation_at;

    let statusColor = theme.palette.grey[500];
    let StatusIcon = HealthIcon;
    let statusText = 'Unknown';
    let tooltipText = 'Validation status unknown';

    if (validationStatus === 'healthy') {
      statusColor = theme.palette.success.main;
      StatusIcon = CheckCircleIcon;
      statusText = 'Healthy';
      tooltipText = `Health score: ${validationScore || 'N/A'}`;
    } else if (validationStatus === 'warning') {
      statusColor = theme.palette.warning.main;
      StatusIcon = WarningIcon;
      statusText = 'Warning';
      tooltipText = `Health score: ${validationScore || 'N/A'} - Issues detected`;
    } else if (validationStatus === 'critical') {
      statusColor = theme.palette.error.main;
      StatusIcon = CriticalIcon;
      statusText = 'Critical';
      tooltipText = `Health score: ${validationScore || 'N/A'} - Critical issues`;
    } else if (validationStatus === 'validating') {
      statusColor = theme.palette.info.main;
      StatusIcon = HealthIcon;
      statusText = 'Validating';
      tooltipText = 'Validation check in progress';
    }

    if (lastValidationAt) {
      const lastValidation = new Date(lastValidationAt);
      tooltipText += `\nLast checked: ${formatDistanceToNow(lastValidation)} ago`;
    }

    return (
      <Tooltip title={tooltipText}>
        <Chip
          icon={<StatusIcon />}
          label={statusText}
          size="small"
          sx={{
            bgcolor: alpha(statusColor, 0.1),
            color: statusColor,
            borderColor: statusColor,
            border: '1px solid',
            '& .MuiChip-icon': {
              color: statusColor,
            },
          }}
        />
      </Tooltip>
    );
  };

  // Utility functions for folder management
  const addFolder = () => {
    if (newFolder && !formData.watch_folders.includes(newFolder)) {
      setFormData({
        ...formData,
        watch_folders: [...formData.watch_folders, newFolder]
      });
      setNewFolder('');
    }
  };

  const removeFolder = (folderToRemove: string) => {
    setFormData({
      ...formData,
      watch_folders: formData.watch_folders.filter(folder => folder !== folderToRemove)
    });
  };

  // Utility functions for file extension management
  const addFileExtension = () => {
    if (newExtension && !formData.file_extensions.includes(newExtension)) {
      setFormData({
        ...formData,
        file_extensions: [...formData.file_extensions, newExtension]
      });
      setNewExtension('');
    }
  };

  const removeFileExtension = (extensionToRemove: string) => {
    setFormData({
      ...formData,
      file_extensions: formData.file_extensions.filter(ext => ext !== extensionToRemove)
    });
  };

  // Crawl estimation function
  const estimateCrawl = async () => {
    setEstimatingCrawl(true);
    try {
      let response;
      if (editingSource) {
        // Use the source-specific endpoint for existing sources
        response = await api.post(`/sources/${editingSource.id}/estimate`);
      } else {
        // Use the general endpoint with provided config for new sources
        response = await api.post('/sources/estimate', {
          server_url: formData.server_url,
          username: formData.username,
          password: formData.password,
          watch_folders: formData.watch_folders,
          file_extensions: formData.file_extensions,
          auto_sync: formData.auto_sync,
          sync_interval_minutes: formData.sync_interval_minutes,
          server_type: formData.server_type,
        });
      }
      setCrawlEstimate(response.data);
      showSnackbar('Crawl estimation completed', 'success');
    } catch (error) {
      console.error('Failed to estimate crawl:', error);
      showSnackbar('Failed to estimate crawl', 'error');
    } finally {
      setEstimatingCrawl(false);
    }
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'webdav':
        return <CloudIcon />;
      case 's3':
        return <CloudIcon />;
      case 'local_folder':
        return <FolderIcon />;
      default:
        return <StorageIcon />;
    }
  };

  const getStatusIcon = (source: Source) => {
    if (source.status === 'syncing') {
      return <SyncIcon sx={{ animation: 'spin 2s linear infinite' }} />;
    } else if (source.status === 'error') {
      return <ErrorIcon />;
    } else {
      return <CheckCircleIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'syncing':
        return theme.palette.info.main;
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.success.main;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const StatCard = ({ icon, label, value, color = 'primary', tooltip }: { 
    icon: React.ReactNode; 
    label: string; 
    value: string | number; 
    color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
    tooltip?: string;
  }) => {
    const card = (
      <Box 
        sx={{ 
          p: 2.5, 
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
          position: 'relative',
          overflow: 'hidden',
          height: '100px',
          display: 'flex',
          alignItems: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, ${theme.palette[color].main}, ${theme.palette[color].light})`,
          }
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', overflow: 'hidden' }}>
          <Avatar 
            sx={{ 
              bgcolor: alpha(theme.palette[color].main, 0.15),
              color: theme.palette[color].main,
              width: 40,
              height: 40,
              flexShrink: 0
            }}
          >
            {icon}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography 
              variant="h5" 
              fontWeight="bold" 
              color={theme.palette[color].main}
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.75rem'
              }}
            >
              {label}
            </Typography>
          </Box>
        </Stack>
      </Box>
    );

    return tooltip ? (
      <Tooltip title={tooltip} arrow>
        {card}
      </Tooltip>
    ) : card;
  };

  const renderSourceCard = (source: Source) => (
    <Fade in={true} key={source.id}>
      <Box>
        <Card 
        data-testid="source-item"
        sx={{ 
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[8],
            '& .action-buttons': {
              opacity: 1,
              transform: 'translateY(0)',
            }
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: source.enabled 
              ? `linear-gradient(90deg, ${getStatusColor(source.status)}, ${alpha(getStatusColor(source.status), 0.7)})`
              : theme.palette.grey[300],
          }
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar 
                sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  width: 56,
                  height: 56,
                }}
              >
                {getSourceIcon(source.source_type)}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {source.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    label={source.source_type.toUpperCase()}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      borderRadius: 2,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  />
                  <Chip
                    icon={getStatusIcon(source)}
                    label={source.status.charAt(0).toUpperCase() + source.status.slice(1)}
                    size="small"
                    sx={{ 
                      borderRadius: 2,
                      bgcolor: alpha(getStatusColor(source.status), 0.1),
                      color: getStatusColor(source.status),
                      border: `1px solid ${alpha(getStatusColor(source.status), 0.3)}`,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  />
                  <Chip
                    icon={<DocumentIcon sx={{ fontSize: '0.9rem !important' }} />}
                    label={`${source.total_documents} docs`}
                    size="small"
                    sx={{ 
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      color: theme.palette.info.main,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  />
                  <Chip
                    icon={<OcrIcon sx={{ fontSize: '0.9rem !important' }} />}
                    label={`${source.total_documents_ocr} OCR'd`}
                    size="small"
                    sx={{ 
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: theme.palette.success.main,
                      border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  />
                  {!source.enabled && (
                    <Chip 
                      label="Disabled" 
                      size="small" 
                      color="default"
                      sx={{ borderRadius: 2, fontSize: '0.75rem' }}
                    />
                  )}
                </Stack>
              </Box>
            </Stack>

            {/* Action Buttons */}
            <Stack 
              direction="row" 
              spacing={1}
              className="action-buttons"
              sx={{
                opacity: 0,
                transform: 'translateY(-8px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {source.status === 'syncing' ? (
                <Tooltip title="Stop Sync">
                  <span>
                    <IconButton
                      onClick={() => handleStopSync(source.id)}
                      disabled={stoppingSync === source.id}
                      sx={{
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) },
                        color: theme.palette.warning.main,
                      }}
                    >
                      {stoppingSync === source.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <StopIcon />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Tooltip title="Trigger Sync">
                  <span>
                    <IconButton
                      onClick={() => handleOpenSyncModal(source)}
                      disabled={syncingSource === source.id || deepScanning || !source.enabled}
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                      }}
                    >
                      {syncingSource === source.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <PlayArrowIcon />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {/* Validation Status Display */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                {renderValidationStatus(source)}
                <Tooltip title="Run Validation Check">
                  <IconButton
                    onClick={() => handleValidation(source.id)}
                    disabled={validating === source.id || source.status === 'syncing' || !source.enabled}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.2) },
                      color: theme.palette.info.main,
                    }}
                  >
                    {validating === source.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <HealthIcon />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
              <Tooltip title="Edit Source">
                <IconButton 
                  onClick={() => handleEditSource(source)}
                  sx={{
                    bgcolor: alpha(theme.palette.grey[500], 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.grey[500], 0.2) },
                  }}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="View Ignored Files">
                <IconButton 
                  onClick={() => navigate(`/ignored-files?sourceType=${source.source_type}&sourceName=${encodeURIComponent(source.name)}&sourceId=${source.id}`)}
                  sx={{
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) },
                    color: theme.palette.warning.main,
                  }}
                >
                  <BlockIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Source">
                <IconButton 
                  onClick={() => handleDeleteSource(source)}
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) },
                    color: theme.palette.error.main,
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Stats Grid */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard
                icon={<DocumentIcon />}
                label="Documents Stored"
                value={source.total_documents}
                color="info"
                tooltip="Total number of documents currently stored from this source"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard
                icon={<OcrIcon />}
                label="OCR Processed"
                value={source.total_documents_ocr}
                color="success"
                tooltip="Number of documents that have been successfully OCR'd"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard
                icon={<TimelineIcon />}
                label="Last Sync"
                value={source.last_sync_at
                  ? formatDistanceToNow(new Date(source.last_sync_at), { addSuffix: true })
                  : 'Never'}
                color="primary"
                tooltip="When this source was last synchronized"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard
                icon={<SpeedIcon />}
                label="Files Pending"
                value={source.total_files_pending}
                color="warning"
                tooltip="Files discovered but not yet processed during sync"
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard
                icon={<StorageIcon />}
                label="Total Size"
                value={formatBytes(source.total_size_bytes)}
                color="primary"
                tooltip="Total size of files successfully downloaded from this source"
              />
            </Grid>
          </Grid>

          {/* Sync Progress Display */}
          <SyncProgressDisplay
            sourceId={source.id}
            sourceName={source.name}
            isVisible={source.status === 'syncing'}
          />

          {/* Error Alert */}
          {source.last_error && (
            <Alert 
              severity="error" 
              sx={{ 
                borderRadius: 3,
                '& .MuiAlert-icon': {
                  fontSize: '1.2rem',
                }
              }}
            >
              <Typography variant="body2" fontWeight="medium">
                {source.last_error}
              </Typography>
              {source.last_error_at && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.8 }}>
                  {formatDistanceToNow(new Date(source.last_error_at), { addSuffix: true })}
                </Typography>
              )}
            </Alert>
          )}
        </CardContent>
        </Card>
      </Box>
    </Fade>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 6 }}>
        <Typography 
          variant="h3" 
          component="h1" 
          fontWeight="bold"
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            mb: 2,
          }}
        >
          Document Sources
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          Connect and manage your document sources with intelligent syncing
        </Typography>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={handleCreateSource}
            data-testid="add-source"
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Add Source
          </Button>
          
          <Button
            variant="outlined"
            size="large"
            startIcon={autoRefreshing ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
            onClick={loadSources}
            disabled={autoRefreshing}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {autoRefreshing ? 'Auto-refreshing...' : 'Refresh'}
          </Button>

          {/* OCR Controls for Admin Users */}
          {user?.role === 'Admin' && (
            <>
              {ocrLoading ? (
                <CircularProgress size={24} />
              ) : ocrStatus.is_paused ? (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<ResumeIcon />}
                  onClick={handleResumeOcr}
                  sx={{
                    borderRadius: 3,
                    px: 4,
                    py: 1.5,
                    borderWidth: 2,
                    borderColor: 'success.main',
                    color: 'success.main',
                    '&:hover': {
                      borderWidth: 2,
                      borderColor: 'success.dark',
                      backgroundColor: alpha(theme.palette.success.main, 0.1),
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  Resume OCR
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<PauseIcon />}
                  onClick={handlePauseOcr}
                  sx={{
                    borderRadius: 3,
                    px: 4,
                    py: 1.5,
                    borderWidth: 2,
                    borderColor: 'warning.main',
                    color: 'warning.main',
                    '&:hover': {
                      borderWidth: 2,
                      borderColor: 'warning.dark',
                      backgroundColor: alpha(theme.palette.warning.main, 0.1),
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  Pause OCR
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} thickness={3} />
        </Box>
      ) : sources.length === 0 ? (
        <Paper 
          sx={{ 
            p: 8, 
            textAlign: 'center',
            borderRadius: 4,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Avatar 
            sx={{ 
              width: 80, 
              height: 80, 
              mx: 'auto', 
              mb: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            }}
          >
            <StorageIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            No Sources Configured
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            Connect your first document source to start automatically syncing and processing your files with AI-powered OCR.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={handleCreateSource}
            sx={{
              borderRadius: 3,
              px: 6,
              py: 2,
              fontSize: '1.1rem',
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Add Your First Source
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={4} data-testid="sources-list">
          {sources.map(renderSourceCard)}
        </Grid>
      )}

      {/* Create/Edit Dialog - Enhanced */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: theme.palette.background.paper,
          }
        }}
      >
        <DialogTitle sx={{ p: 4, pb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar 
              sx={{ 
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            >
              {editingSource ? <EditIcon /> : <AddIcon />}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {editingSource ? 'Edit Source' : 'Create New Source'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {editingSource ? 'Update your source configuration' : 'Connect a new document source'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        
        <DialogContent sx={{ p: 4, pt: 2 }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Source Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Document Server"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }}
            />

            {!editingSource && (
              <FormControl fullWidth>
                <InputLabel>Source Type</InputLabel>
                <Select
                  value={formData.source_type}
                  onChange={(e) => setFormData({ ...formData, source_type: e.target.value as any })}
                  label="Source Type"
                  sx={{
                    borderRadius: 2,
                  }}
                >
                  <MenuItem value="webdav">
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <CloudIcon />
                      <Box>
                        <Typography variant="body1">WebDAV</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Nextcloud, ownCloud, and other WebDAV servers
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="local_folder">
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <FolderIcon />
                      <Box>
                        <Typography variant="body1">Local Folder</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Monitor local filesystem directories
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="s3">
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <CloudIcon />
                      <Box>
                        <Typography variant="body1">S3 Compatible</Typography>
                        <Typography variant="caption" color="text.secondary">
                          AWS S3, MinIO, and other S3-compatible storage
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            {formData.source_type === 'webdav' && (
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <Stack spacing={3}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <CloudIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      WebDAV Configuration
                    </Typography>
                  </Stack>
                  
                  <TextField
                    fullWidth
                    label="Server URL"
                    value={formData.server_url}
                    onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
                    placeholder={
                      formData.server_type === 'nextcloud' 
                        ? "https://nextcloud.example.com/"
                        : formData.server_type === 'owncloud'
                        ? "https://owncloud.example.com/remote.php/dav/files/username/"
                        : "https://webdav.example.com/dav/"
                    }
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                  </Grid>

                  <FormControl fullWidth>
                    <InputLabel>Server Type</InputLabel>
                    <Select
                      value={formData.server_type}
                      onChange={(e) => setFormData({ ...formData, server_type: e.target.value as any })}
                      label="Server Type"
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="nextcloud">
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <ServerIcon />
                          <Box>
                            <Typography variant="body1">Nextcloud</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Optimized for Nextcloud servers
                            </Typography>
                          </Box>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="owncloud">
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <ServerIcon />
                          <Box>
                            <Typography variant="body1">ownCloud</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Optimized for ownCloud servers
                            </Typography>
                          </Box>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="generic">
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <CloudIcon />
                          <Box>
                            <Typography variant="body1">Generic WebDAV</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Standard WebDAV protocol
                            </Typography>
                          </Box>
                        </Stack>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.auto_sync}
                        onChange={(e) => setFormData({ ...formData, auto_sync: e.target.checked })}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Enable Automatic Sync
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Automatically sync files on a schedule
                        </Typography>
                      </Box>
                    }
                  />

                  {formData.auto_sync && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Sync Interval (minutes)"
                      value={formData.sync_interval_minutes}
                      onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) || 60 })}
                      inputProps={{ min: 15, max: 1440 }}
                      helperText="How often to check for new files (15 min - 24 hours)"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* Folder Management */}
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: theme.palette.secondary.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <FolderIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      Folders to Monitor
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Specify which folders to scan for files. Use absolute paths starting with "/".
                  </Typography>

                  <Stack direction="row" spacing={1} mb={2}>
                    <TextField
                      label="Add Folder Path"
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                      placeholder="/Documents"
                      sx={{ 
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                      }}
                    />
                    <Button 
                      variant="outlined" 
                      onClick={addFolder} 
                      disabled={!newFolder}
                      sx={{ borderRadius: 2, px: 3 }}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Box sx={{ mb: 3 }}>
                    {formData.watch_folders.map((folder, index) => (
                      <Chip
                        key={index}
                        label={folder}
                        onDelete={() => removeFolder(folder)}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          color: theme.palette.secondary.main,
                        }}
                      />
                    ))}
                  </Box>

                  {/* File Extensions */}
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <ExtensionIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      File Extensions
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    File types to sync and process with OCR.
                  </Typography>

                  <Stack direction="row" spacing={1} mb={2}>
                    <TextField
                      label="Add Extension"
                      value={newExtension}
                      onChange={(e) => setNewExtension(e.target.value)}
                      placeholder="docx"
                      sx={{ 
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                      }}
                    />
                    <Button 
                      variant="outlined" 
                      onClick={addFileExtension} 
                      disabled={!newExtension}
                      sx={{ borderRadius: 2, px: 3 }}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Box sx={{ mb: 3 }}>
                    {formData.file_extensions.map((extension, index) => (
                      <Chip
                        key={index}
                        label={extension}
                        onDelete={() => removeFileExtension(extension)}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.warning.main, 0.1),
                          color: theme.palette.warning.main,
                        }}
                      />
                    ))}
                  </Box>

                  {/* Crawl Estimation */}
                  {editingSource && formData.server_url && formData.username && formData.watch_folders.length > 0 && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      
                      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                        <Avatar 
                          sx={{ 
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main,
                            width: 32,
                            height: 32,
                          }}
                        >
                          <AssessmentIcon />
                        </Avatar>
                        <Typography variant="h6" fontWeight="medium">
                          Crawl Estimation
                        </Typography>
                      </Stack>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Estimate how many files will be processed and how long it will take.
                      </Typography>

                      <Button
                        variant="outlined"
                        onClick={estimateCrawl}
                        disabled={estimatingCrawl}
                        startIcon={estimatingCrawl ? <CircularProgress size={20} /> : <AssessmentIcon />}
                        sx={{ mb: 2, borderRadius: 2 }}
                      >
                        {estimatingCrawl ? 'Estimating...' : 'Estimate Crawl'}
                      </Button>

                      {estimatingCrawl && (
                        <Box sx={{ mb: 2 }}>
                          <LinearProgress sx={{ borderRadius: 1 }} />
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Analyzing folders and counting files...
                          </Typography>
                        </Box>
                      )}

                      {crawlEstimate && (
                        <Paper 
                          sx={{ 
                            p: 3, 
                            borderRadius: 3,
                            bgcolor: alpha(theme.palette.info.main, 0.03),
                            border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                            mb: 2
                          }}
                        >
                          <Typography variant="h6" sx={{ mb: 2 }}>
                            Estimation Results
                          </Typography>
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="primary">
                                  {crawlEstimate.total_files?.toLocaleString() || '0'}
                                </Typography>
                                <Typography variant="body2">Total Files</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="success.main">
                                  {crawlEstimate.total_supported_files?.toLocaleString() || '0'}
                                </Typography>
                                <Typography variant="body2">Supported Files</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="warning.main">
                                  {crawlEstimate.total_estimated_time_hours?.toFixed(1) || '0'}h
                                </Typography>
                                <Typography variant="body2">Estimated Time</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="info.main">
                                  {crawlEstimate.total_size_mb ? (crawlEstimate.total_size_mb / 1024).toFixed(1) : '0'}GB
                                </Typography>
                                <Typography variant="body2">Total Size</Typography>
                              </Box>
                            </Grid>
                          </Grid>

                          {crawlEstimate.folders && crawlEstimate.folders.length > 0 && (
                            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Folder</TableCell>
                                    <TableCell align="right">Total Files</TableCell>
                                    <TableCell align="right">Supported</TableCell>
                                    <TableCell align="right">Est. Time</TableCell>
                                    <TableCell align="right">Size (MB)</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {crawlEstimate.folders.map((folder: any) => (
                                    <TableRow key={folder.path}>
                                      <TableCell>{folder.path}</TableCell>
                                      <TableCell align="right">{folder.total_files?.toLocaleString() || '0'}</TableCell>
                                      <TableCell align="right">{folder.supported_files?.toLocaleString() || '0'}</TableCell>
                                      <TableCell align="right">{folder.estimated_time_hours?.toFixed(1) || '0'}h</TableCell>
                                      <TableCell align="right">{folder.total_size_mb?.toFixed(1) || '0'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                        </Paper>
                      )}
                    </>
                  )}
                </Stack>
              </Paper>
            )}

            {formData.source_type === 'local_folder' && (
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.warning.main, 0.03),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                }}
              >
                <Stack spacing={3}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <FolderIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      Local Folder Configuration
                    </Typography>
                  </Stack>
                  
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2">
                      Monitor local filesystem directories for new documents. 
                      Ensure the application has read access to the specified paths.
                    </Typography>
                  </Alert>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.recursive}
                        onChange={(e) => setFormData({ ...formData, recursive: e.target.checked })}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Recursive Scanning
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Scan subdirectories recursively
                        </Typography>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.follow_symlinks}
                        onChange={(e) => setFormData({ ...formData, follow_symlinks: e.target.checked })}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Follow Symbolic Links
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Follow symlinks when scanning directories
                        </Typography>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.auto_sync}
                        onChange={(e) => setFormData({ ...formData, auto_sync: e.target.checked })}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Enable Automatic Sync
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Automatically scan for new files on a schedule
                        </Typography>
                      </Box>
                    }
                  />

                  {formData.auto_sync && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Sync Interval (minutes)"
                      value={formData.sync_interval_minutes}
                      onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) || 60 })}
                      inputProps={{ min: 15, max: 1440 }}
                      helperText="How often to scan for new files (15 min - 24 hours)"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* Folder Management */}
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: theme.palette.secondary.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <FolderIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      Directories to Monitor
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Specify which local directories to scan for files. Use absolute paths.
                  </Typography>

                  <Stack direction="row" spacing={1} mb={2}>
                    <TextField
                      label="Add Directory Path"
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                      placeholder="/home/user/Documents"
                      sx={{ 
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                      }}
                    />
                    <Button 
                      variant="outlined" 
                      onClick={addFolder} 
                      disabled={!newFolder}
                      sx={{ borderRadius: 2, px: 3 }}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Box sx={{ mb: 3 }}>
                    {formData.watch_folders.map((folder, index) => (
                      <Chip
                        key={index}
                        label={folder}
                        onDelete={() => removeFolder(folder)}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          color: theme.palette.secondary.main,
                        }}
                      />
                    ))}
                  </Box>

                  {/* File Extensions */}
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <ExtensionIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      File Extensions
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    File types to monitor and process with OCR.
                  </Typography>

                  <Stack direction="row" spacing={1} mb={2}>
                    <TextField
                      label="Add Extension"
                      value={newExtension}
                      onChange={(e) => setNewExtension(e.target.value)}
                      placeholder="docx"
                      sx={{ 
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                      }}
                    />
                    <Button 
                      variant="outlined" 
                      onClick={addFileExtension} 
                      disabled={!newExtension}
                      sx={{ borderRadius: 2, px: 3 }}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Box sx={{ mb: 3 }}>
                    {formData.file_extensions.map((extension, index) => (
                      <Chip
                        key={index}
                        label={extension}
                        onDelete={() => removeFileExtension(extension)}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.warning.main, 0.1),
                          color: theme.palette.warning.main,
                        }}
                      />
                    ))}
                  </Box>
                </Stack>
              </Paper>
            )}

            {formData.source_type === 's3' && (
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.success.main, 0.03),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                }}
              >
                <Stack spacing={3}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        color: theme.palette.success.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <CloudIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      S3 Compatible Storage Configuration
                    </Typography>
                  </Stack>
                  
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2">
                      Connect to AWS S3, MinIO, or any S3-compatible storage service. 
                      For MinIO, provide the endpoint URL of your server.
                    </Typography>
                  </Alert>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Bucket Name"
                        value={formData.bucket_name}
                        onChange={(e) => setFormData({ ...formData, bucket_name: e.target.value })}
                        placeholder="my-documents-bucket"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Region"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        placeholder="us-east-1"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Access Key ID"
                        value={formData.access_key_id}
                        onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Secret Access Key"
                        type="password"
                        value={formData.secret_access_key}
                        onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                  </Grid>

                  <TextField
                    fullWidth
                    label="Endpoint URL (Optional)"
                    value={formData.endpoint_url}
                    onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                    placeholder="https://minio.example.com (for MinIO/S3-compatible services)"
                    helperText="Leave empty for AWS S3, or provide custom endpoint for MinIO/other S3-compatible storage"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  <TextField
                    fullWidth
                    label="Object Key Prefix (Optional)"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                    placeholder="documents/"
                    helperText="Optional prefix to limit scanning to specific object keys"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.auto_sync}
                        onChange={(e) => setFormData({ ...formData, auto_sync: e.target.checked })}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          Enable Automatic Sync
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Automatically check for new objects on a schedule
                        </Typography>
                      </Box>
                    }
                  />

                  {formData.auto_sync && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Sync Interval (minutes)"
                      value={formData.sync_interval_minutes}
                      onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) || 60 })}
                      inputProps={{ min: 15, max: 1440 }}
                      helperText="How often to check for new objects (15 min - 24 hours)"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* Folder Management (prefixes for S3) */}
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: theme.palette.secondary.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <FolderIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      Object Prefixes to Monitor
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Specify which object prefixes (like folders) to scan for files.
                  </Typography>

                  <Stack direction="row" spacing={1} mb={2}>
                    <TextField
                      label="Add Object Prefix"
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                      placeholder="documents/"
                      sx={{ 
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                      }}
                    />
                    <Button 
                      variant="outlined" 
                      onClick={addFolder} 
                      disabled={!newFolder}
                      sx={{ borderRadius: 2, px: 3 }}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Box sx={{ mb: 3 }}>
                    {formData.watch_folders.map((folder, index) => (
                      <Chip
                        key={index}
                        label={folder}
                        onDelete={() => removeFolder(folder)}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          color: theme.palette.secondary.main,
                        }}
                      />
                    ))}
                  </Box>

                  {/* File Extensions */}
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                        width: 32,
                        height: 32,
                      }}
                    >
                      <ExtensionIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="medium">
                      File Extensions
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    File types to sync and process with OCR.
                  </Typography>

                  <Stack direction="row" spacing={1} mb={2}>
                    <TextField
                      label="Add Extension"
                      value={newExtension}
                      onChange={(e) => setNewExtension(e.target.value)}
                      placeholder="docx"
                      sx={{ 
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': { borderRadius: 2 } 
                      }}
                    />
                    <Button 
                      variant="outlined" 
                      onClick={addFileExtension} 
                      disabled={!newExtension}
                      sx={{ borderRadius: 2, px: 3 }}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Box sx={{ mb: 3 }}>
                    {formData.file_extensions.map((extension, index) => (
                      <Chip
                        key={index}
                        label={extension}
                        onDelete={() => removeFileExtension(extension)}
                        sx={{ 
                          mr: 1, 
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.warning.main, 0.1),
                          color: theme.palette.warning.main,
                        }}
                      />
                    ))}
                  </Box>
                </Stack>
              </Paper>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Source Enabled
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable this source for syncing
                  </Typography>
                </Box>
              }
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 4, pt: 2 }}>
          <Button 
            onClick={() => setDialogOpen(false)}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          {(formData.source_type === 'webdav' || formData.source_type === 'local_folder' || formData.source_type === 's3') && (
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection || 
                (formData.source_type === 'webdav' && (!formData.server_url || !formData.username)) ||
                (formData.source_type === 'local_folder' && formData.watch_folders.length === 0) ||
                (formData.source_type === 's3' && (!formData.bucket_name || !formData.access_key_id || !formData.secret_access_key))
              }
              startIcon={testingConnection ? <CircularProgress size={20} /> : <SecurityIcon />}
              sx={{ borderRadius: 2 }}
            >
              Test Connection
            </Button>
          )}
          <Button 
            onClick={handleSaveSource} 
            variant="contained"
            sx={{
              borderRadius: 2,
              px: 4,
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            }}
          >
            {editingSource ? 'Save Changes' : 'Create Source'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Source</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{sourceToDelete?.name}"?
          </DialogContentText>
          <DialogContentText variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. The source configuration and all associated sync history will be permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
            sx={{
              borderRadius: 2,
              px: 3,
            }}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync Type Selection Modal */}
      <Dialog 
        open={syncModalOpen} 
        onClose={handleCloseSyncModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SyncIcon color="primary" />
            Choose Sync Type
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            {sourceToSync && (
              <>
                Select the type of synchronization for <strong>{sourceToSync.name}</strong>:
              </>
            )}
          </DialogContentText>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  border: '2px solid transparent',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={handleQuickSync}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <QuickSyncIcon 
                    sx={{ 
                      fontSize: 48, 
                      color: 'primary.main', 
                      mb: 2,
                    }} 
                  />
                  <Typography variant="h6" gutterBottom>
                    Quick Sync
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fast incremental sync using ETags. Only processes new or changed files.
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip label="Recommended" color="primary" size="small" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Card 
                sx={{ 
                  cursor: sourceToSync?.source_type === 'webdav' ? 'pointer' : 'not-allowed',
                  border: '2px solid transparent',
                  transition: 'all 0.2s',
                  opacity: sourceToSync?.source_type === 'webdav' ? 1 : 0.6,
                  '&:hover': sourceToSync?.source_type === 'webdav' ? {
                    borderColor: 'warning.main',
                    bgcolor: 'action.hover',
                  } : {},
                }}
                onClick={sourceToSync?.source_type === 'webdav' ? handleDeepScan : undefined}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <DeepScanIcon 
                    sx={{ 
                      fontSize: 48, 
                      color: sourceToSync?.source_type === 'webdav' ? 'warning.main' : 'text.disabled', 
                      mb: 2,
                    }} 
                  />
                  <Typography variant="h6" gutterBottom>
                    Deep Scan
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Complete rescan that resets ETag expectations. Use for troubleshooting sync issues.
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {sourceToSync?.source_type === 'webdav' ? (
                      <Chip label="WebDAV Only" color="warning" size="small" />
                    ) : (
                      <Chip label="Not Available" color="default" size="small" />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          {sourceToSync?.source_type !== 'webdav' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Deep scan is currently only available for WebDAV sources. Other source types will use quick sync.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSyncModal}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            borderRadius: 3,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Container>
  );
};

export default SourcesPage;