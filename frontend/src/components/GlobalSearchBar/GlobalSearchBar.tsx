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
  SxProps,
  Theme,
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
import { documentService, SearchRequest } from '../../services/api';

interface GlobalSearchBarProps {
  sx?: SxProps<Theme>;
  [key: string]: any;
}

interface Document {
  id: string;
  original_filename: string;
  filename?: string;
  file_size: number;
  mime_type: string;
  has_ocr_text?: boolean;
  search_rank?: number;
  snippets?: Array<{ text: string }>;
}

interface SearchResponse {
  documents: Document[];
  total_count: number;
  search_time_ms: number;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ sx, ...props }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [searchProgress, setSearchProgress] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popularSearches] = useState<string[]>(['invoice', 'contract', 'report', 'presentation', 'agreement']);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

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
  const saveRecentSearch = useCallback((searchQuery: string): void => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 5); // Keep only last 5 searches
    
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  }, [recentSearches]);

  // Enhanced debounced search function with typing indicators
  const debounce = useCallback((func: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      setIsTyping(true);
      timeoutId = setTimeout(() => {
        setIsTyping(false);
        func.apply(null, args);
      }, delay);
    };
  }, []);

  // Generate smart suggestions
  const generateSuggestions = useCallback((searchQuery: string): void => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const smartSuggestions: string[] = [];
    
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

  const performSearch = useCallback(async (searchQuery: string): Promise<void> => {
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
      
      const searchRequest: SearchRequest = {
        query: searchQuery.trim(),
        limit: 5, // Show only top 5 results in global search
        include_snippets: true, // Include snippets for context
        snippet_length: 100, // Shorter snippets for quick search
        search_mode: searchQuery.length < 4 ? 'fuzzy' : 'simple', // Use fuzzy for short queries (substring matching)
      };

      const response = await documentService.enhancedSearch(searchRequest);

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

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
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

  const handleInputFocus = (): void => {
    setShowResults(true);
  };

  const handleClickAway = (): void => {
    setShowResults(false);
  };

  const handleClear = (): void => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setShowResults(false);
    setIsTyping(false);
    setSearchProgress(0);
  };

  const handleDocumentClick = (doc: Document): void => {
    saveRecentSearch(query);
    setShowResults(false);
    navigate(`/documents/${doc.id}`);
  };

  const handleRecentSearchClick = (searchQuery: string): void => {
    setQuery(searchQuery);
    performSearch(searchQuery);
  };
  
  const handleSuggestionClick = (suggestion: string): void => {
    setQuery(suggestion);
    performSearch(suggestion);
  };
  
  const handlePopularSearchClick = (search: string): void => {
    setQuery(search);
    performSearch(search);
    setShowResults(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
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

  const getFileIcon = (mimeType: string): React.ReactElement => {
    if (mimeType.includes('pdf')) return <PdfIcon color="error" />;
    if (mimeType.includes('image')) return <ImageIcon color="primary" />;
    if (mimeType.includes('text')) return <TextIcon color="info" />;
    return <DocIcon color="secondary" />;
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Function to highlight search terms in text (including substrings)
  const highlightText = useCallback((text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm || !text) return text;
    
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(term => term.length >= 2);
    let highlightedText = text;
    
    terms.forEach(term => {
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedText = highlightedText.replace(regex, (match) => `**${match}**`);
    });
    
    // Split by ** markers and create spans
    const parts = highlightedText.split(/\*\*(.*?)\*\*/);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a highlighted part
        return (
          <Box
            key={index}
            component="mark"
            sx={{
              backgroundColor: 'primary.light',
              color: 'primary.contrastText',
              padding: '0 2px',
              borderRadius: '2px',
              fontWeight: 600,
            }}
          >
            {part}
          </Box>
        );
      }
      return part;
    });
  }, []);

  // Enhanced search with context snippets
  const generateContextSnippet = useCallback((filename: string, searchTerm: string): string => {
    if (!searchTerm || !filename) return filename;
    
    const lowerFilename = filename.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    
    // Find the best match (exact term or substring)
    const exactMatch = lowerFilename.indexOf(lowerTerm);
    if (exactMatch !== -1) {
      // Show context around the match
      const start = Math.max(0, exactMatch - 10);
      const end = Math.min(filename.length, exactMatch + searchTerm.length + 10);
      const snippet = filename.substring(start, end);
      return start > 0 ? `...${snippet}` : snippet;
    }
    
    // Look for partial word matches
    const words = filename.split(/[_\-\s\.]/);
    const matchingWord = words.find(word => 
      word.toLowerCase().includes(lowerTerm) || lowerTerm.includes(word.toLowerCase())
    );
    
    if (matchingWord) {
      const wordIndex = words.indexOf(matchingWord);
      const contextWords = words.slice(Math.max(0, wordIndex - 1), Math.min(words.length, wordIndex + 2));
      return contextWords.join(' ');
    }
    
    return filename;
  }, []);

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
                          component="div"
                          onClick={() => handleDocumentClick(doc)}
                          sx={{
                            py: 1,
                            cursor: 'pointer',
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
                                {highlightText(generateContextSnippet(doc.original_filename, query), query)}
                              </Typography>
                            }
                            secondary={
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
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
                                
                                {/* Show content snippet if available */}
                                {doc.snippets && doc.snippets.length > 0 && (
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary"
                                    sx={{
                                      display: 'block',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontSize: '0.7rem',
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    {highlightText(doc.snippets[0].text.substring(0, 80) + '...', query)}
                                  </Typography>
                                )}
                              </Box>
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
                          component="div"
                          onClick={() => handleRecentSearchClick(search)}
                          sx={{
                            py: 1,
                            cursor: 'pointer',
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