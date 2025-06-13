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
  CircularProgress,
  LinearProgress,
  Skeleton,
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
  const [isTyping, setIsTyping] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [popularSearches] = useState(['invoice', 'contract', 'report', 'presentation', 'agreement']);
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

  // Enhanced debounced search function with typing indicators
  const debounce = useCallback((func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      setIsTyping(true);
      timeoutId = setTimeout(() => {
        setIsTyping(false);
        func.apply(null, args);
      }, delay);
    };
  }, []);

  // Generate smart suggestions
  const generateSuggestions = useCallback((searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const smartSuggestions = [];
    
    // Add similar popular searches
    const similar = popularSearches.filter(search => 
      search.toLowerCase().includes(searchQuery.toLowerCase()) ||
      searchQuery.toLowerCase().includes(search.toLowerCase())
    );
    smartSuggestions.push(...similar);
    
    // Add exact phrase suggestion
    if (!searchQuery.includes('"')) {
      smartSuggestions.push(`"${searchQuery}"`);
    }
    
    // Add tag search suggestion
    if (!searchQuery.startsWith('tag:')) {
      smartSuggestions.push(`tag:${searchQuery}`);
    }
    
    setSuggestions(smartSuggestions.slice(0, 3));
  }, [popularSearches]);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      setSearchProgress(0);
      
      // Progressive loading for better UX
      const progressInterval = setInterval(() => {
        setSearchProgress(prev => Math.min(prev + 25, 90));
      }, 50);
      
      const response = await documentService.enhancedSearch({
        query: searchQuery.trim(),
        limit: 5, // Show only top 5 results in global search
        include_snippets: false, // Don't need snippets for quick search
        search_mode: 'simple',
      });

      clearInterval(progressInterval);
      setSearchProgress(100);
      setResults(response.data.documents || []);
      
      // Clear progress after brief delay
      setTimeout(() => setSearchProgress(0), 300);
    } catch (error) {
      console.error('Global search failed:', error);
      setResults([]);
      setSearchProgress(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    debounce(performSearch, 200), // Even faster debounce for global search
    [performSearch]
  );
  
  const debouncedSuggestions = useCallback(
    debounce(generateSuggestions, 100), // Very fast suggestions
    [generateSuggestions]
  );

  const handleInputChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setShowResults(true);
    
    if (value.trim()) {
      debouncedSearch(value);
      debouncedSuggestions(value);
    } else {
      setResults([]);
      setSuggestions([]);
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
    setSuggestions([]);
    setShowResults(false);
    setIsTyping(false);
    setSearchProgress(0);
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
  
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };
  
  const handlePopularSearchClick = (search) => {
    setQuery(search);
    performSearch(search);
    setShowResults(false);
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
        <Box sx={{ position: 'relative' }}>
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
              endAdornment: (
                <InputAdornment position="end">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {(loading || isTyping) && (
                      <CircularProgress 
                        size={16} 
                        variant={searchProgress > 0 ? "determinate" : "indeterminate"}
                        value={searchProgress}
                      />
                    )}
                    {query && (
                      <IconButton size="small" onClick={handleClear}>
                        <ClearIcon />
                      </IconButton>
                    )}
                  </Stack>
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: 300,
              maxWidth: 400,
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'background.paper',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'background.paper',
                  borderColor: 'primary.main',
                },
                '&.Mui-focused': {
                  backgroundColor: 'background.paper',
                  borderColor: 'primary.main',
                  borderWidth: 2,
                },
              },
            }}
          />
          
          {/* Enhanced Loading Progress Bar */}
          {(loading || isTyping || searchProgress > 0) && (
            <LinearProgress 
              variant={searchProgress > 0 ? "determinate" : "indeterminate"}
              value={searchProgress}
              sx={{ 
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                borderRadius: '0 0 4px 4px',
                opacity: isTyping ? 0.6 : 1,
                transition: 'opacity 0.2s ease-in-out',
              }}
            />
          )}
        </Box>

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
                {(loading || isTyping) && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Stack spacing={1} alignItems="center">
                      <CircularProgress size={20} />
                      <Typography variant="body2" color="text.secondary">
                        {isTyping ? 'Searching as you type...' : 'Searching...'}
                      </Typography>
                    </Stack>
                  </Box>
                )}
                
                {/* Loading Skeletons for better UX */}
                {loading && query && (
                  <List sx={{ py: 0 }}>
                    {[1, 2, 3].map((i) => (
                      <ListItem key={i} sx={{ py: 1 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Skeleton variant="circular" width={24} height={24} />
                        </ListItemIcon>
                        <ListItemText
                          primary={<Skeleton variant="text" width="80%" />}
                          secondary={<Skeleton variant="text" width="60%" />}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}

                {!loading && !isTyping && query && results.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      No documents found for "{query}"
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Press Enter to search with advanced options
                    </Typography>
                    
                    {/* Smart suggestions for no results */}
                    {suggestions.length > 0 && (
                      <>
                        <Typography variant="caption" color="text.primary" gutterBottom sx={{ display: 'block' }}>
                          Try these suggestions:
                        </Typography>
                        <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap">
                          {suggestions.map((suggestion, index) => (
                            <Chip
                              key={index}
                              label={suggestion}
                              size="small"
                              variant="outlined"
                              clickable
                              onClick={() => handleSuggestionClick(suggestion)}
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          ))}
                        </Stack>
                      </>
                    )}
                  </Box>
                )}

                {!loading && !isTyping && results.length > 0 && (
                  <>
                    <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Quick Results
                        </Typography>
                        <Typography variant="caption" color="primary">
                          {results.length} found
                        </Typography>
                      </Stack>
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
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Start typing to search documents
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Popular searches:
                    </Typography>
                    <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
                      {popularSearches.slice(0, 3).map((search, index) => (
                        <Chip 
                          key={index}
                          label={search} 
                          size="small" 
                          variant="outlined" 
                          clickable
                          onClick={() => handlePopularSearchClick(search)}
                          sx={{ 
                            fontSize: '0.75rem',
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'primary.contrastText',
                            }
                          }}
                        />
                      ))}
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