import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  FormControl,
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
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const SettingsPage = () => {
  const { user: currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({
    ocrLanguage: 'eng',
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
      setSettings(response.data);
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
      await api.put('/settings', { ...settings, [key]: value });
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
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Select the primary language for OCR text extraction. This affects how accurately text is recognized from images and scanned documents.
                  </Typography>
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