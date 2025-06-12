import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Chip,
  Stack,
  ClickAwayListener,
  Grow,
  Popper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Description as DocIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  TextSnippet as TextIcon,
  TrendingUp as TrendingIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { documentService } from '../../services/api';

const GlobalSearchBar = ({ sx, ...props }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const searchInputRef = useRef(null);
  const anchorRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((searchQuery) => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 5); // Keep only last 5 searches
    
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  }, [recentSearches]);

  // Debounced search function
  const debounce = useCallback((func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await documentService.enhancedSearch({
        query: searchQuery.trim(),
        limit: 5, // Show only top 5 results in global search
        include_snippets: false, // Don't need snippets for quick search
        search_mode: 'simple',
      });

      setResults(response.data.documents || []);
    } catch (error) {
      console.error('Global search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    debounce(performSearch, 300), // Faster debounce for global search
    [performSearch]
  );

  const handleInputChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setShowResults(true);
    
    if (value.trim()) {
      debouncedSearch(value);
    } else {
      setResults([]);
    }
  };

  const handleInputFocus = () => {
    setShowResults(true);
  };

  const handleClickAway = () => {
    setShowResults(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleDocumentClick = (doc) => {
    saveRecentSearch(query);
    setShowResults(false);
    navigate(`/documents/${doc.id}`);
  };

  const handleRecentSearchClick = (searchQuery) => {
    setQuery(searchQuery);
    performSearch(searchQuery);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && query.trim()) {
      saveRecentSearch(query);
      setShowResults(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
    if (event.key === 'Escape') {
      setShowResults(false);
      searchInputRef.current?.blur();
    }
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

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', ...sx }} {...props}>
        <TextField
          ref={searchInputRef}
          size="small"
          placeholder="Search documents..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClear}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 300,
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'background.paper',
              },
              '&.Mui-focused': {
                backgroundColor: 'background.paper',
              },
            },
          }}
        />

        {/* Search Results Dropdown */}
        <Popper
          open={showResults}
          anchorEl={searchInputRef.current}
          placement="bottom-start"
          style={{ zIndex: 1300, width: searchInputRef.current?.offsetWidth }}
          transition
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps}>
              <Paper
                elevation={8}
                sx={{
                  mt: 1,
                  maxHeight: 400,
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {loading && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Searching...
                    </Typography>
                  </Box>
                )}

                {!loading && query && results.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No documents found
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Press Enter to search with advanced options
                    </Typography>
                  </Box>
                )}

                {!loading && results.length > 0 && (
                  <>
                    <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                        Quick Results
                      </Typography>
                    </Box>
                    <List sx={{ py: 0 }}>
                      {results.map((doc) => (
                        <ListItem
                          key={doc.id}
                          button
                          onClick={() => handleDocumentClick(doc)}
                          sx={{
                            py: 1,
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {getFileIcon(doc.mime_type)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography
                                variant="body2"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.original_filename}
                              </Typography>
                            }
                            secondary={
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  {formatFileSize(doc.file_size)}
                                </Typography>
                                {doc.has_ocr_text && (
                                  <Chip
                                    label="OCR"
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 16, fontSize: '0.6rem' }}
                                  />
                                )}
                                {doc.search_rank && (
                                  <Chip
                                    icon={<TrendingIcon sx={{ fontSize: 10 }} />}
                                    label={`${(doc.search_rank * 100).toFixed(0)}%`}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    sx={{ height: 16, fontSize: '0.6rem' }}
                                  />
                                )}
                              </Stack>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                    
                    {results.length >= 5 && (
                      <Box sx={{ p: 1, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography
                          variant="caption"
                          color="primary"
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                          onClick={() => {
                            saveRecentSearch(query);
                            setShowResults(false);
                            navigate(`/search?q=${encodeURIComponent(query)}`);
                          }}
                        >
                          View all results for "{query}"
                        </Typography>
                      </Box>
                    )}
                  </>
                )}

                {!query && recentSearches.length > 0 && (
                  <>
                    <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                        Recent Searches
                      </Typography>
                    </Box>
                    <List sx={{ py: 0 }}>
                      {recentSearches.map((search, index) => (
                        <ListItem
                          key={index}
                          button
                          onClick={() => handleRecentSearchClick(search)}
                          sx={{
                            py: 1,
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <TimeIcon color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2">
                                {search}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}

                {!query && recentSearches.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Start typing to search documents
                    </Typography>
                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
                      <Chip label="invoice" size="small" variant="outlined" />
                      <Chip label="contract" size="small" variant="outlined" />
                      <Chip label="report" size="small" variant="outlined" />
                    </Stack>
                  </Box>
                )}
              </Paper>
            </Grow>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default GlobalSearchBar;