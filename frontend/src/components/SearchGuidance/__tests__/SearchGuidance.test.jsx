import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchGuidance from '../SearchGuidance';

describe('SearchGuidance', () => {
  const mockOnExampleClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders search guidance with examples in expanded mode', () => {
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    expect(screen.getByText('Search Help & Examples')).toBeInTheDocument();
    
    // Click to expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(accordionButton);
    
    expect(screen.getByText('Example Searches')).toBeInTheDocument();
    expect(screen.getByText('Search Tips')).toBeInTheDocument();
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
  });

  test('renders compact mode correctly', () => {
    render(<SearchGuidance compact onExampleClick={mockOnExampleClick} />);
    
    const helpButton = screen.getByRole('button');
    expect(helpButton).toBeInTheDocument();
    
    // Initially collapsed in compact mode
    expect(screen.queryByText('Quick Search Tips')).not.toBeInTheDocument();
  });

  test('toggles compact help visibility', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance compact onExampleClick={mockOnExampleClick} />);
    
    const helpButton = screen.getByRole('button');
    
    // Expand help
    await user.click(helpButton);
    
    expect(screen.getByText('Quick Search Tips')).toBeInTheDocument();
    expect(screen.getByText('• Use quotes for exact phrases: "annual report"')).toBeInTheDocument();
    
    // Collapse help
    await user.click(helpButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Quick Search Tips')).not.toBeInTheDocument();
    });
  });

  test('displays search examples with clickable items', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Check for example queries
    expect(screen.getByText('invoice 2024')).toBeInTheDocument();
    expect(screen.getByText('"project proposal"')).toBeInTheDocument();
    expect(screen.getByText('tag:important')).toBeInTheDocument();
    expect(screen.getByText('contract AND payment')).toBeInTheDocument();
    expect(screen.getByText('proj*')).toBeInTheDocument();
  });

  test('calls onExampleClick when example is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Click on an example
    const exampleItem = screen.getByText('invoice 2024').closest('li');
    await user.click(exampleItem);
    
    expect(mockOnExampleClick).toHaveBeenCalledWith('invoice 2024');
  });

  test('displays search tips', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Check for search tips
    expect(screen.getByText('• Use quotes for exact phrases: "annual report"')).toBeInTheDocument();
    expect(screen.getByText('• Search by tags: tag:urgent or tag:personal')).toBeInTheDocument();
    expect(screen.getByText('• Use AND/OR for complex queries: (invoice OR receipt) AND 2024')).toBeInTheDocument();
    expect(screen.getByText('• Wildcards work great: proj* finds project, projects, projection')).toBeInTheDocument();
    expect(screen.getByText('• Search OCR text in images and PDFs automatically')).toBeInTheDocument();
    expect(screen.getByText('• File types are searchable: PDF, Word, Excel, images')).toBeInTheDocument();
  });

  test('displays quick start chips that are clickable', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Click on a quick start chip
    const chipElement = screen.getByText('invoice 2024');
    await user.click(chipElement);
    
    expect(mockOnExampleClick).toHaveBeenCalledWith('invoice 2024');
  });

  test('compact mode shows limited examples', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance compact onExampleClick={mockOnExampleClick} />);
    
    const helpButton = screen.getByRole('button');
    await user.click(helpButton);
    
    // Should show only first 3 examples in compact mode
    expect(screen.getByText('invoice 2024')).toBeInTheDocument();
    expect(screen.getByText('"project proposal"')).toBeInTheDocument();
    expect(screen.getByText('tag:important')).toBeInTheDocument();
    
    // Should not show all examples in compact mode
    expect(screen.queryByText('contract AND payment')).not.toBeInTheDocument();
  });

  test('compact mode shows limited tips', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance compact onExampleClick={mockOnExampleClick} />);
    
    const helpButton = screen.getByRole('button');
    await user.click(helpButton);
    
    // Should show only first 3 tips in compact mode
    const tips = screen.getAllByText(/^•/);
    expect(tips).toHaveLength(3);
  });

  test('handles missing onExampleClick gracefully', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Click on an example - should not crash
    const exampleItem = screen.getByText('invoice 2024').closest('li');
    await user.click(exampleItem);
    
    // Should not crash when onExampleClick is not provided
    expect(true).toBe(true);
  });

  test('displays correct icons for different example types', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Check for different icons (by test id)
    expect(screen.getByTestId('SearchIcon')).toBeInTheDocument();
    expect(screen.getByTestId('FormatQuoteIcon')).toBeInTheDocument();
    expect(screen.getByTestId('TagIcon')).toBeInTheDocument();
    expect(screen.getByTestId('ExtensionIcon')).toBeInTheDocument();
    expect(screen.getByTestId('TrendingUpIcon')).toBeInTheDocument();
  });

  test('compact mode toggle button changes icon', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance compact onExampleClick={mockOnExampleClick} />);
    
    const helpButton = screen.getByRole('button');
    
    // Initially shows help icon
    expect(screen.getByTestId('HelpIcon')).toBeInTheDocument();
    
    // Click to expand
    await user.click(helpButton);
    
    // Should show close icon when expanded
    expect(screen.getByTestId('CloseIcon')).toBeInTheDocument();
  });

  test('applies custom styling props', () => {
    const customSx = { backgroundColor: 'red' };
    render(<SearchGuidance sx={customSx} data-testid="search-guidance" />);
    
    const component = screen.getByTestId('search-guidance');
    expect(component).toBeInTheDocument();
  });

  test('provides helpful descriptions for each search example', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Check for example descriptions
    expect(screen.getByText('Find documents containing both "invoice" and "2024"')).toBeInTheDocument();
    expect(screen.getByText('Search for exact phrase "project proposal"')).toBeInTheDocument();
    expect(screen.getByText('Find all documents tagged as "important"')).toBeInTheDocument();
    expect(screen.getByText('Advanced search using AND operator')).toBeInTheDocument();
    expect(screen.getByText('Wildcard search for project, projects, etc.')).toBeInTheDocument();
  });

  test('keyboard navigation works for examples', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // Tab to first example and press Enter
    const firstExample = screen.getByText('invoice 2024').closest('li');
    firstExample.focus();
    await user.keyboard('{Enter}');
    
    expect(mockOnExampleClick).toHaveBeenCalledWith('invoice 2024');
  });
});

describe('SearchGuidance Accessibility', () => {
  test('has proper ARIA labels and roles', async () => {
    const user = userEvent.setup();
    render(<SearchGuidance />);
    
    // Accordion should have proper role
    const accordion = screen.getByRole('button', { expanded: false });
    expect(accordion).toBeInTheDocument();
    
    // Expand to check list accessibility
    await user.click(accordion);
    
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBeGreaterThan(0);
  });

  test('compact mode has accessible toggle button', () => {
    render(<SearchGuidance compact />);
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('type', 'button');
  });

  test('examples are keyboard accessible', async () => {
    const user = userEvent.setup();
    const mockOnExampleClick = jest.fn();
    render(<SearchGuidance onExampleClick={mockOnExampleClick} />);
    
    // Expand accordion
    const accordionButton = screen.getByRole('button', { expanded: false });
    await user.click(accordionButton);
    
    // All examples should be focusable
    const examples = screen.getAllByRole('listitem');
    examples.forEach(example => {
      expect(example).toHaveAttribute('tabindex', '0');
    });
  });
});