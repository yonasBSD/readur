import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Snackbar,
  Alert,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Divider,
  Switch,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const SettingsPage = () => {
  const { user: currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({
    ocrLanguage: 'eng',
    concurrentOcrJobs: 4,
    ocrTimeoutSeconds: 300,
    maxFileSizeMb: 50,
    allowedFileTypes: ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'txt'],
    autoRotateImages: true,
    enableImagePreprocessing: true,
    searchResultsPerPage: 25,
    searchSnippetLength: 200,
    fuzzySearchThreshold: 0.8,
    retentionDays: null,
    enableAutoCleanup: false,
    enableCompression: false,
    memoryLimitMb: 512,
    cpuPriority: 'normal',
    enableBackgroundOcr: true,
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [userDialog, setUserDialog] = useState({ open: false, mode: 'create', user: null });
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '' });

  const ocrLanguages = [
    { code: 'eng', name: 'English' },
    { code: 'spa', name: 'Spanish' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'ita', name: 'Italian' },
    { code: 'por', name: 'Portuguese' },
    { code: 'rus', name: 'Russian' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'chi_sim', name: 'Chinese (Simplified)' },
    { code: 'chi_tra', name: 'Chinese (Traditional)' },
    { code: 'kor', name: 'Korean' },
    { code: 'ara', name: 'Arabic' },
    { code: 'hin', name: 'Hindi' },
    { code: 'nld', name: 'Dutch' },
    { code: 'pol', name: 'Polish' },
  ];

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings({
        ocrLanguage: response.data.ocr_language || 'eng',
        concurrentOcrJobs: response.data.concurrent_ocr_jobs || 4,
        ocrTimeoutSeconds: response.data.ocr_timeout_seconds || 300,
        maxFileSizeMb: response.data.max_file_size_mb || 50,
        allowedFileTypes: response.data.allowed_file_types || ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'txt'],
        autoRotateImages: response.data.auto_rotate_images !== undefined ? response.data.auto_rotate_images : true,
        enableImagePreprocessing: response.data.enable_image_preprocessing !== undefined ? response.data.enable_image_preprocessing : true,
        searchResultsPerPage: response.data.search_results_per_page || 25,
        searchSnippetLength: response.data.search_snippet_length || 200,
        fuzzySearchThreshold: response.data.fuzzy_search_threshold || 0.8,
        retentionDays: response.data.retention_days,
        enableAutoCleanup: response.data.enable_auto_cleanup || false,
        enableCompression: response.data.enable_compression || false,
        memoryLimitMb: response.data.memory_limit_mb || 512,
        cpuPriority: response.data.cpu_priority || 'normal',
        enableBackgroundOcr: response.data.enable_background_ocr !== undefined ? response.data.enable_background_ocr : true,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      if (error.response?.status !== 404) {
        showSnackbar('Failed to load settings', 'error');
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      if (error.response?.status !== 404) {
        showSnackbar('Failed to load users', 'error');
      }
    }
  };

  const handleSettingsChange = async (key, value) => {
    setLoading(true);
    try {
      // Convert camelCase to snake_case for API
      const snakeCase = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      const apiKey = snakeCase(key);
      
      // Build the update payload with only the changed field
      const updatePayload = { [apiKey]: value };
      
      await api.put('/settings', updatePayload);
      setSettings({ ...settings, [key]: value });
      showSnackbar('Settings updated successfully', 'success');
    } catch (error) {
      console.error('Error updating settings:', error);
      showSnackbar('Failed to update settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async () => {
    setLoading(true);
    try {
      if (userDialog.mode === 'create') {
        await api.post('/users', userForm);
        showSnackbar('User created successfully', 'success');
      } else {
        const { password, ...updateData } = userForm;
        if (password) {
          updateData.password = password;
        }
        await api.put(`/users/${userDialog.user.id}`, updateData);
        showSnackbar('User updated successfully', 'success');
      }
      fetchUsers();
      handleCloseUserDialog();
    } catch (error) {
      console.error('Error saving user:', error);
      showSnackbar(error.response?.data?.message || 'Failed to save user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser.id) {
      showSnackbar('You cannot delete your own account', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user?')) {
      setLoading(true);
      try {
        await api.delete(`/users/${userId}`);
        showSnackbar('User deleted successfully', 'success');
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        showSnackbar('Failed to delete user', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenUserDialog = (mode, user = null) => {
    setUserDialog({ open: true, mode, user });
    if (mode === 'edit' && user) {
      setUserForm({ username: user.username, email: user.email, password: '' });
    } else {
      setUserForm({ username: '', email: '', password: '' });
    }
  };

  const handleCloseUserDialog = () => {
    setUserDialog({ open: false, mode: 'create', user: null });
    setUserForm({ username: '', email: '', password: '' });
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Settings
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
          <Tab label="General" />
          <Tab label="User Management" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 3 }}>
                General Settings
              </Typography>

              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    OCR Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>OCR Language</InputLabel>
                        <Select
                          value={settings.ocrLanguage}
                          label="OCR Language"
                          onChange={(e) => handleSettingsChange('ocrLanguage', e.target.value)}
                          disabled={loading}
                        >
                          {ocrLanguages.map((lang) => (
                            <MenuItem key={lang.code} value={lang.code}>
                              {lang.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Concurrent OCR Jobs"
                        value={settings.concurrentOcrJobs}
                        onChange={(e) => handleSettingsChange('concurrentOcrJobs', parseInt(e.target.value))}
                        disabled={loading}
                        inputProps={{ min: 1, max: 16 }}
                        helperText="Number of OCR jobs that can run simultaneously"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="OCR Timeout (seconds)"
                        value={settings.ocrTimeoutSeconds}
                        onChange={(e) => handleSettingsChange('ocrTimeoutSeconds', parseInt(e.target.value))}
                        disabled={loading}
                        inputProps={{ min: 30, max: 3600 }}
                        helperText="Maximum time for OCR processing per file"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>CPU Priority</InputLabel>
                        <Select
                          value={settings.cpuPriority}
                          label="CPU Priority"
                          onChange={(e) => handleSettingsChange('cpuPriority', e.target.value)}
                          disabled={loading}
                        >
                          <MenuItem value="low">Low</MenuItem>
                          <MenuItem value="normal">Normal</MenuItem>
                          <MenuItem value="high">High</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    File Processing
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Max File Size (MB)"
                        value={settings.maxFileSizeMb}
                        onChange={(e) => handleSettingsChange('maxFileSizeMb', parseInt(e.target.value))}
                        disabled={loading}
                        inputProps={{ min: 1, max: 500 }}
                        helperText="Maximum allowed file size for uploads"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Memory Limit (MB)"
                        value={settings.memoryLimitMb}
                        onChange={(e) => handleSettingsChange('memoryLimitMb', parseInt(e.target.value))}
                        disabled={loading}
                        inputProps={{ min: 128, max: 4096 }}
                        helperText="Memory limit per OCR job"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl sx={{ mb: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.autoRotateImages}
                              onChange={(e) => handleSettingsChange('autoRotateImages', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Auto-rotate Images"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Automatically detect and correct image orientation
                        </Typography>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl sx={{ mb: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enableImagePreprocessing}
                              onChange={(e) => handleSettingsChange('enableImagePreprocessing', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Enable Image Preprocessing"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Enhance images for better OCR accuracy (deskew, denoise, contrast)
                        </Typography>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl sx={{ mb: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enableBackgroundOcr}
                              onChange={(e) => handleSettingsChange('enableBackgroundOcr', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Enable Background OCR"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Process OCR in the background after file upload
                        </Typography>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Search Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Results Per Page</InputLabel>
                        <Select
                          value={settings.searchResultsPerPage}
                          label="Results Per Page"
                          onChange={(e) => handleSettingsChange('searchResultsPerPage', parseInt(e.target.value))}
                          disabled={loading}
                        >
                          <MenuItem value={10}>10</MenuItem>
                          <MenuItem value={25}>25</MenuItem>
                          <MenuItem value={50}>50</MenuItem>
                          <MenuItem value={100}>100</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Snippet Length"
                        value={settings.searchSnippetLength}
                        onChange={(e) => handleSettingsChange('searchSnippetLength', parseInt(e.target.value))}
                        disabled={loading}
                        inputProps={{ min: 50, max: 500 }}
                        helperText="Characters to show in search result previews"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Fuzzy Search Threshold"
                        value={settings.fuzzySearchThreshold}
                        onChange={(e) => handleSettingsChange('fuzzySearchThreshold', parseFloat(e.target.value))}
                        disabled={loading}
                        inputProps={{ min: 0, max: 1, step: 0.1 }}
                        helperText="Tolerance for spelling mistakes (0.0-1.0)"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Storage Management
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Retention Days"
                        value={settings.retentionDays || ''}
                        onChange={(e) => handleSettingsChange('retentionDays', e.target.value ? parseInt(e.target.value) : null)}
                        disabled={loading}
                        inputProps={{ min: 1 }}
                        helperText="Auto-delete documents after X days (leave empty to disable)"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl sx={{ mb: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enableAutoCleanup}
                              onChange={(e) => handleSettingsChange('enableAutoCleanup', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Enable Auto Cleanup"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Automatically remove orphaned files and clean up storage
                        </Typography>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl sx={{ mb: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enableCompression}
                              onChange={(e) => handleSettingsChange('enableCompression', e.target.checked)}
                              disabled={loading}
                            />
                          }
                          label="Enable Compression"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Compress stored documents to save disk space
                        </Typography>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}

          {tabValue === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  User Management
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenUserDialog('create')}
                  disabled={loading}
                >
                  Add User
                </Button>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Created At</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleOpenUserDialog('edit', user)}
                            disabled={loading}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={loading || user.id === currentUser.id}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog open={userDialog.open} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {userDialog.mode === 'create' ? 'Create New User' : 'Edit User'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={userDialog.mode === 'create' ? 'Password' : 'New Password (leave empty to keep current)'}
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required={userDialog.mode === 'create'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUserDialog} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleUserSubmit} variant="contained" disabled={loading}>
            {userDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default SettingsPage;