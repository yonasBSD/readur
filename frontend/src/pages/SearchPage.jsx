import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as DocIcon,
  TextSnippet as TextIcon,
  CalendarToday as DateIcon,
  Storage as SizeIcon,
  Tag as TagIcon,
} from '@mui/icons-material';
import { documentService } from '../services/api';

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  
  // Filter states
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedMimeTypes, setSelectedMimeTypes] = useState([]);
  const [dateRange, setDateRange] = useState([0, 365]); // days
  const [fileSizeRange, setFileSizeRange] = useState([0, 100]); // MB
  const [hasOcr, setHasOcr] = useState('all');
  
  // Available options (would typically come from API)
  const [availableTags, setAvailableTags] = useState([]);
  const mimeTypeOptions = [
    { value: 'application/pdf', label: 'PDF' },
    { value: 'image/', label: 'Images' },
    { value: 'text/', label: 'Text Files' },
    { value: 'application/msword', label: 'Word Documents' },
    { value: 'application/vnd.openxmlformats-officedocument', label: 'Office Documents' },
  ];

  // Debounced search
  const debounce = useCallback((func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  const performSearch = useCallback(async (query, filters = {}) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const searchRequest = {
        query: query.trim(),
        tags: filters.tags?.length ? filters.tags : undefined,
        mime_types: filters.mimeTypes?.length ? filters.mimeTypes : undefined,
        limit: 100,
        offset: 0,
      };

      const response = await documentService.search(searchRequest);
      
      // Apply additional client-side filters
      let results = response.data.documents || [];
      
      // Filter by date range
      if (filters.dateRange) {
        const now = new Date();
        const [minDays, maxDays] = filters.dateRange;
        results = results.filter(doc => {
          const docDate = new Date(doc.created_at);
          const daysDiff = Math.ceil((now - docDate) / (1000 * 60 * 60 * 24));
          return daysDiff >= minDays && daysDiff <= maxDays;
        });
      }
      
      // Filter by file size
      if (filters.fileSizeRange) {
        const [minMB, maxMB] = filters.fileSizeRange;
        results = results.filter(doc => {
          const sizeMB = doc.file_size / (1024 * 1024);
          return sizeMB >= minMB && sizeMB <= maxMB;
        });
      }
      
      // Filter by OCR status
      if (filters.hasOcr && filters.hasOcr !== 'all') {
        results = results.filter(doc => {
          return filters.hasOcr === 'yes' ? doc.has_ocr_text : !doc.has_ocr_text;
        });
      }
      
      setSearchResults(results);
      
      // Extract unique tags for filter options
      const tags = [...new Set(results.flatMap(doc => doc.tags))];
      setAvailableTags(tags);
      
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    debounce((query, filters) => performSearch(query, filters), 500),
    [performSearch]
  );

  useEffect(() => {
    const filters = {
      tags: selectedTags,
      mimeTypes: selectedMimeTypes,
      dateRange: dateRange,
      fileSizeRange: fileSizeRange,
      hasOcr: hasOcr,
    };
    debouncedSearch(searchQuery, filters);
  }, [searchQuery, selectedTags, selectedMimeTypes, dateRange, fileSizeRange, hasOcr, debouncedSearch]);

  const handleClearFilters = () => {
    setSelectedTags([]);
    setSelectedMimeTypes([]);
    setDateRange([0, 365]);
    setFileSizeRange([0, 100]);
    setHasOcr('all');
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes('pdf')) return <PdfIcon color="error" />;
    if (mimeType.includes('image')) return <ImageIcon color="primary" />;
    if (mimeType.includes('text')) return <TextIcon color="info" />;
    return <DocIcon color="secondary" />;
  };

  const formatFileSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDownload = async (doc) => {
    try {
      const response = await documentService.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.original_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 800,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            mb: 1,
          }}
        >
          Search Documents
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Find documents using full-text search and advanced filters
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Filters Sidebar */}
        <Grid item xs={12} md={3}>
          <Card sx={{ position: 'sticky', top: 20 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FilterIcon />
                  Filters
                </Typography>
                <Button size="small" onClick={handleClearFilters} startIcon={<ClearIcon />}>
                  Clear
                </Button>
              </Box>

              <Stack spacing={3}>
                {/* Tags Filter */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">Tags</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Tags</InputLabel>
                      <Select
                        multiple
                        value={selectedTags}
                        onChange={(e) => setSelectedTags(e.target.value)}
                        input={<OutlinedInput label="Select Tags" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                      >
                        {availableTags.map((tag) => (
                          <MenuItem key={tag} value={tag}>
                            <Checkbox checked={selectedTags.indexOf(tag) > -1} />
                            <ListItemText primary={tag} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </AccordionDetails>
                </Accordion>

                {/* File Type Filter */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">File Types</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Types</InputLabel>
                      <Select
                        multiple
                        value={selectedMimeTypes}
                        onChange={(e) => setSelectedMimeTypes(e.target.value)}
                        input={<OutlinedInput label="Select Types" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const option = mimeTypeOptions.find(opt => opt.value === value);
                              return (
                                <Chip key={value} label={option?.label || value} size="small" />
                              );
                            })}
                          </Box>
                        )}
                      >
                        {mimeTypeOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <Checkbox checked={selectedMimeTypes.indexOf(option.value) > -1} />
                            <ListItemText primary={option.label} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </AccordionDetails>
                </Accordion>

                {/* OCR Filter */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">OCR Status</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormControl fullWidth size="small">
                      <InputLabel>OCR Text</InputLabel>
                      <Select
                        value={hasOcr}
                        onChange={(e) => setHasOcr(e.target.value)}
                        label="OCR Text"
                      >
                        <MenuItem value="all">All Documents</MenuItem>
                        <MenuItem value="yes">Has OCR Text</MenuItem>
                        <MenuItem value="no">No OCR Text</MenuItem>
                      </Select>
                    </FormControl>
                  </AccordionDetails>
                </Accordion>

                {/* Date Range Filter */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">Date Range</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Days ago: {dateRange[0]} - {dateRange[1]}
                    </Typography>
                    <Slider
                      value={dateRange}
                      onChange={(e, newValue) => setDateRange(newValue)}
                      valueLabelDisplay="auto"
                      min={0}
                      max={365}
                      marks={[
                        { value: 0, label: 'Today' },
                        { value: 30, label: '30d' },
                        { value: 90, label: '90d' },
                        { value: 365, label: '1y' },
                      ]}
                    />
                  </AccordionDetails>
                </Accordion>

                {/* File Size Filter */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">File Size</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Size: {fileSizeRange[0]}MB - {fileSizeRange[1]}MB
                    </Typography>
                    <Slider
                      value={fileSizeRange}
                      onChange={(e, newValue) => setFileSizeRange(newValue)}
                      valueLabelDisplay="auto"
                      min={0}
                      max={100}
                      marks={[
                        { value: 0, label: '0MB' },
                        { value: 10, label: '10MB' },
                        { value: 50, label: '50MB' },
                        { value: 100, label: '100MB' },
                      ]}
                    />
                  </AccordionDetails>
                </Accordion>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Search Results */}
        <Grid item xs={12} md={9}>
          {/* Search Bar */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search documents by filename, content, or tags..."
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderWidth: 2,
                  },
                },
              }}
            />
          </Box>

          {/* Toolbar */}
          <Box sx={{ 
            mb: 3, 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Typography variant="body2" color="text.secondary">
              {loading ? 'Searching...' : `${searchResults.length} results found`}
            </Typography>
            
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newView) => newView && setViewMode(newView)}
              size="small"
            >
              <ToggleButton value="grid">
                <GridViewIcon />
              </ToggleButton>
              <ToggleButton value="list">
                <ListViewIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Results */}
          {loading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {!loading && !error && searchQuery && searchResults.length === 0 && (
            <Box 
              sx={{ 
                textAlign: 'center', 
                py: 8,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderRadius: 2,
                border: '1px dashed',
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No results found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search terms or filters
              </Typography>
            </Box>
          )}

          {!loading && !error && !searchQuery && (
            <Box 
              sx={{ 
                textAlign: 'center', 
                py: 8,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderRadius: 2,
              }}
            >
              <SearchIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Start searching
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter keywords to search through your documents
              </Typography>
            </Box>
          )}

          {!loading && !error && searchResults.length > 0 && (
            <Grid container spacing={viewMode === 'grid' ? 3 : 1}>
              {searchResults.map((doc) => (
                <Grid 
                  item 
                  xs={12} 
                  sm={viewMode === 'grid' ? 6 : 12} 
                  md={viewMode === 'grid' ? 6 : 12} 
                  lg={viewMode === 'grid' ? 4 : 12}
                  key={doc.id}
                >
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: viewMode === 'list' ? 'row' : 'column',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: (theme) => theme.shadows[4],
                      },
                    }}
                  >
                    {viewMode === 'grid' && (
                      <Box
                        sx={{
                          height: 100,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                        }}
                      >
                        <Box sx={{ fontSize: '2.5rem' }}>
                          {getFileIcon(doc.mime_type)}
                        </Box>
                      </Box>
                    )}
                    
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        {viewMode === 'list' && (
                          <Box sx={{ mr: 1, mt: 0.5 }}>
                            {getFileIcon(doc.mime_type)}
                          </Box>
                        )}
                        
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontSize: '0.95rem',
                              fontWeight: 600,
                              mb: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={doc.original_filename}
                          >
                            {doc.original_filename}
                          </Typography>
                          
                          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                            <Chip 
                              label={formatFileSize(doc.file_size)} 
                              size="small" 
                              variant="outlined"
                            />
                            <Chip 
                              label={formatDate(doc.created_at)} 
                              size="small" 
                              variant="outlined"
                            />
                            {doc.has_ocr_text && (
                              <Chip 
                                label="OCR" 
                                size="small" 
                                color="success"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                          
                          {doc.tags.length > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
                              {doc.tags.slice(0, 2).map((tag, index) => (
                                <Chip 
                                  key={index}
                                  label={tag} 
                                  size="small" 
                                  color="primary"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: '18px' }}
                                />
                              ))}
                              {doc.tags.length > 2 && (
                                <Chip 
                                  label={`+${doc.tags.length - 2}`}
                                  size="small" 
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: '18px' }}
                                />
                              )}
                            </Stack>
                          )}
                        </Box>
                        
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/documents/${doc.id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(doc)}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default SearchPage;