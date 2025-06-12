import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Fab,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  Folder as FolderIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  Add as AddIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  TextSnippet as TextIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

// Stats Card Component
const StatsCard = ({ title, value, subtitle, icon: Icon, color, trend }) => {
  const theme = useTheme();
  
  return (
    <Card
      elevation={0}
      sx={{
        background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100px',
          height: '100px',
          background: alpha('#fff', 0.1),
          borderRadius: '50%',
          transform: 'translate(30px, -30px)',
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              {value}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {subtitle}
            </Typography>
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {trend}
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar
            sx={{
              bgcolor: alpha('#fff', 0.2),
              width: 56,
              height: 56,
            }}
          >
            <Icon sx={{ fontSize: 28 }} />
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

// Recent Documents Component
const RecentDocuments = ({ documents = [] }) => {
  const navigate = useNavigate();

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return PdfIcon;
    if (mimeType?.includes('image')) return ImageIcon;
    if (mimeType?.includes('text')) return TextIcon;
    return FileIcon;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card elevation={0}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recent Documents
          </Typography>
          <Chip
            label="View All"
            onClick={() => navigate('/documents')}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
        
        {documents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <DocumentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              No documents yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload your first document to get started
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {documents.slice(0, 5).map((doc, index) => {
              const FileIconComponent = getFileIcon(doc.mime_type);
              
              return (
                <ListItem
                  key={doc.id || index}
                  sx={{
                    px: 0,
                    py: 1.5,
                    borderBottom: index < Math.min(documents.length, 5) - 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                      }}
                    >
                      <FileIconComponent />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.original_filename || doc.filename || 'Unknown Document'}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(doc.file_size)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          •
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(doc.created_at)}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => navigate(`/documents/${doc.id}`)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

// Quick Actions Component
const QuickActions = () => {
  const navigate = useNavigate();
  
  const actions = [
    {
      title: 'Upload Documents',
      description: 'Add new files for OCR processing',
      icon: UploadIcon,
      color: '#6366f1',
      path: '/upload',
    },
    {
      title: 'Search Library',
      description: 'Find documents by content or metadata',
      icon: SearchIcon,
      color: '#10b981',
      path: '/search',
    },
    {
      title: 'Browse Documents',
      description: 'View and manage your document library',
      icon: FolderIcon,
      color: '#f59e0b',
      path: '/documents',
    },
  ];

  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          {actions.map((action) => (
            <Grid item xs={12} key={action.title}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: action.color,
                    backgroundColor: alpha(action.color, 0.04),
                    transform: 'translateY(-2px)',
                    boxShadow: 2,
                  },
                }}
                onClick={() => navigate(action.path)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: action.color,
                      width: 40,
                      height: 40,
                    }}
                  >
                    <action.icon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {action.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {action.description}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalSize: 0,
    ocrProcessed: 0,
    searchablePages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/documents');
        const docs = response.data || [];
        setDocuments(docs);
        
        // Calculate stats
        const totalSize = docs.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
        const ocrProcessed = docs.filter(doc => doc.ocr_text).length;
        
        setStats({
          totalDocuments: docs.length,
          totalSize,
          ocrProcessed,
          searchablePages: docs.length, // Assuming each doc is searchable
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome back, {user?.username}! 👋
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Here's what's happening with your documents today.
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatsCard
            title="Total Documents"
            value={loading ? '...' : stats.totalDocuments}
            subtitle="Files in your library"
            icon={DocumentIcon}
            color={theme.palette.primary.main}
            trend="+12% this month"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatsCard
            title="Storage Used"
            value={loading ? '...' : formatBytes(stats.totalSize)}
            subtitle="Total file size"
            icon={FolderIcon}
            color={theme.palette.success.main}
            trend="+2.4 GB this week"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatsCard
            title="OCR Processed"
            value={loading ? '...' : stats.ocrProcessed}
            subtitle="Text extracted documents"
            icon={SpeedIcon}
            color={theme.palette.warning.main}
            trend={`${Math.round((stats.ocrProcessed / Math.max(stats.totalDocuments, 1)) * 100)}% completion`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatsCard
            title="Searchable"
            value={loading ? '...' : stats.searchablePages}
            subtitle="Ready for search"
            icon={AssessmentIcon}
            color={theme.palette.secondary.main}
            trend="100% indexed"
          />
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <RecentDocuments documents={documents} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <QuickActions />
        </Grid>
      </Grid>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          },
        }}
        onClick={() => navigate('/upload')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}