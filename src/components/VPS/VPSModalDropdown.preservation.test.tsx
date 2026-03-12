/**
 * Preservation Property Tests for VPS Modal Dropdown Fixes
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7**
 * 
 * These tests verify that existing dropdown functionality remains unchanged after the fix.
 * EXPECTED OUTCOME: These tests MUST PASS on UNFIXED code (establishing baseline behavior)
 * 
 * Preservation areas:
 * - Dropdown search filtering
 * - Click selection and dropdown closing
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - US region flag display
 * - Globe icon fallback for regions without country data
 * - Short dropdown lists (no scrollbar) display all options
 * 
 * CRITICAL: These tests capture current correct behavior that must be preserved.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchableOptionSelect, SearchableOption } from '@/components/VPS/SearchableOptionSelect';
import { RegionSelector } from '@/components/VPS/RegionSelector';
import { renderWithAuth } from '@/test-utils';
import { MapPin } from 'lucide-react';

// Mock fetch for RegionSelector tests
const mockFetch = vi.fn();

// Mock ResizeObserver for cmdk library
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView for cmdk library
Element.prototype.scrollIntoView = vi.fn();

describe('Preservation Properties: VPS Modal Dropdown Functionality', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe('Property 2.1: Dropdown Search Filtering Continues to Work', () => {
    /**
     * **Validates: Requirements 3.2**
     * 
     * This test verifies that search filtering functionality remains unchanged.
     * Users can type in the search box and see filtered results.
     * 
     * EXPECTED: This test PASSES on unfixed code (baseline behavior)
     * AFTER FIX: This test PASSES (behavior preserved)
     */

    it('filters options based on search query', async () => {
      const user = userEvent.setup();
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
        { value: 'nanode', label: 'Nanode', description: 'Lightweight VPS' },
        { value: 'dedicated', label: 'Dedicated CPU', description: 'Dedicated resources' },
        { value: 'premium', label: 'Premium', description: 'High performance' },
        { value: 'highmem', label: 'High Memory', description: 'Memory optimized' },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Open the dropdown
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeTruthy();
      });

      // Type in search box
      const searchInput = screen.getByPlaceholderText('Search categories...');
      await user.type(searchInput, 'dedicated');

      // Verify filtered results - should show "Dedicated CPU"
      await waitFor(() => {
        expect(screen.getByText('Dedicated CPU')).toBeTruthy();
      });

      // Verify other options are not visible (filtered out)
      expect(screen.queryByText('Nanode')).toBeFalsy();
      expect(screen.queryByText('Standard')).toBeFalsy();
    });

    it('shows empty message when no results match search', async () => {
      const user = userEvent.setup();
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
        { value: 'nanode', label: 'Nanode', description: 'Lightweight VPS' },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Open the dropdown
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeTruthy();
      });

      // Type search query that matches nothing
      const searchInput = screen.getByPlaceholderText('Search categories...');
      await user.type(searchInput, 'nonexistent');

      // Verify empty message is shown
      await waitFor(() => {
        expect(screen.getByText('No categories found')).toBeTruthy();
      });
    });
  });

  describe('Property 2.2: Clicking Dropdown Options Continues to Select and Close', () => {
    /**
     * **Validates: Requirements 3.3, 3.7**
     * 
     * This test verifies that clicking an option selects it and closes the dropdown.
     * This is the primary interaction method and must remain unchanged.
     * 
     * EXPECTED: This test PASSES on unfixed code (baseline behavior)
     * AFTER FIX: This test PASSES (behavior preserved)
     */

    it('selects option and closes dropdown when clicked', async () => {
      const user = userEvent.setup();
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
        { value: 'nanode', label: 'Nanode', description: 'Lightweight VPS' },
        { value: 'dedicated', label: 'Dedicated CPU', description: 'Dedicated resources' },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Open the dropdown
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByText('Nanode')).toBeTruthy();
      });

      // Click on an option
      const nanodeOption = screen.getByText('Nanode');
      await user.click(nanodeOption);

      // Verify onChange was called with correct value
      expect(handleChange).toHaveBeenCalledWith('nanode');

      // Verify dropdown is closed (search input should not be visible)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search categories...')).toBeFalsy();
      });
    });

    it('does not select disabled options when clicked', async () => {
      const user = userEvent.setup();
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
        { value: 'nanode', label: 'Nanode', description: 'Lightweight VPS', disabled: true },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Open the dropdown
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByText('Nanode')).toBeTruthy();
      });

      // Try to click on disabled option
      const nanodeOption = screen.getByText('Nanode');
      await user.click(nanodeOption);

      // Verify onChange was NOT called
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Property 2.3: Keyboard Navigation Continues to Work', () => {
    /**
     * **Validates: Requirements 3.3**
     * 
     * This test verifies that keyboard navigation (arrow keys, Enter, Escape) works correctly.
     * This is critical for accessibility and must remain unchanged.
     * 
     * EXPECTED: This test PASSES on unfixed code (baseline behavior)
     * AFTER FIX: This test PASSES (behavior preserved)
     */

    it('navigates options with arrow keys and selects with Enter', async () => {
      const user = userEvent.setup();
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
        { value: 'nanode', label: 'Nanode', description: 'Lightweight VPS' },
        { value: 'dedicated', label: 'Dedicated CPU', description: 'Dedicated resources' },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Open the dropdown with keyboard
      const trigger = screen.getByRole('combobox');
      trigger.focus();
      await user.keyboard('{Enter}');

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeTruthy();
      });

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Select with Enter
      await user.keyboard('{Enter}');

      // Verify onChange was called (second option should be selected)
      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
      });
    });

    it('closes dropdown with Escape key', async () => {
      const user = userEvent.setup();
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
        { value: 'nanode', label: 'Nanode', description: 'Lightweight VPS' },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Open the dropdown
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeTruthy();
      });

      // Press Escape
      await user.keyboard('{Escape}');

      // Verify dropdown is closed
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search categories...')).toBeFalsy();
      });

      // Verify onChange was NOT called
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Property 2.4: US Region Flags Continue to Display Correctly', () => {
    /**
     * **Validates: Requirements 3.4**
     * 
     * This test verifies that US regions continue to display the US flag correctly.
     * This is existing working functionality that must be preserved.
     * 
     * EXPECTED: This test PASSES on unfixed code (baseline behavior)
     * AFTER FIX: This test PASSES (behavior preserved)
     */

    it('displays US flag for US regions', async () => {
      // Mock regions API response with US region
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          regions: [
            { id: 'us-central', label: 'Dallas, TX', country: 'United States', capabilities: ['VPS'] },
          ],
        }),
      });

      const handleSelect = vi.fn();

      const { container } = renderWithAuth(
        <RegionSelector
          providerId="linode"
          selectedRegion="us-central"
          onSelect={handleSelect}
          token="mock-token"
        />
      );

      // Wait for component to render with selected region
      await waitFor(() => {
        const trigger = container.querySelector('[role="combobox"]');
        expect(trigger).toBeTruthy();
      });

      const trigger = container.querySelector('[role="combobox"]');

      // Verify US flag is displayed in the trigger button
      const flagImage = trigger?.querySelector('img[src*="flagcdn.com"][src*="/us.png"]');
      expect(flagImage).toBeTruthy();

      // Verify Globe icon is NOT displayed (flag should be shown)
      const globeIcon = trigger?.querySelector('svg[class*="lucide-globe"]');
      expect(globeIcon).toBeFalsy();
    });

    it('displays US flag for regions with "US" country code', async () => {
      // Mock regions API response with US region using "US" abbreviation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          regions: [
            { id: 'us-west', label: 'Los Angeles, CA', country: 'US', capabilities: ['VPS'] },
          ],
        }),
      });

      const handleSelect = vi.fn();

      const { container } = renderWithAuth(
        <RegionSelector
          providerId="linode"
          selectedRegion="us-west"
          onSelect={handleSelect}
          token="mock-token"
        />
      );

      // Wait for component to render
      await waitFor(() => {
        const trigger = container.querySelector('[role="combobox"]');
        expect(trigger).toBeTruthy();
      });

      const trigger = container.querySelector('[role="combobox"]');

      // Verify US flag is displayed
      const flagImage = trigger?.querySelector('img[src*="flagcdn.com"][src*="/us.png"]');
      expect(flagImage).toBeTruthy();
    });
  });

  describe('Property 2.5: Globe Icon Fallback Continues to Work', () => {
    /**
     * **Validates: Requirements 3.6**
     * 
     * This test verifies that regions with no country data continue to show Globe icon.
     * This is the fallback behavior that must be preserved.
     * 
     * EXPECTED: This test PASSES on unfixed code (baseline behavior)
     * AFTER FIX: This test PASSES (behavior preserved)
     */

    it('displays Globe icon for regions without country data', async () => {
      // Mock regions API response with region that has no country field
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          regions: [
            { id: 'unknown-region', label: 'Unknown Location', capabilities: ['VPS'] },
          ],
        }),
      });

      const handleSelect = vi.fn();

      const { container } = renderWithAuth(
        <RegionSelector
          providerId="linode"
          selectedRegion="unknown-region"
          onSelect={handleSelect}
          token="mock-token"
        />
      );

      // Wait for component to render
      await waitFor(() => {
        const trigger = container.querySelector('[role="combobox"]');
        expect(trigger).toBeTruthy();
      });

      const trigger = container.querySelector('[role="combobox"]');

      // Verify Globe icon IS displayed (fallback behavior)
      const globeIcon = trigger?.querySelector('svg[class*="lucide-globe"]');
      expect(globeIcon).toBeTruthy();

      // Verify no flag image is displayed
      const flagImage = trigger?.querySelector('img[src*="flagcdn.com"]');
      expect(flagImage).toBeFalsy();
    });

    it('displays Globe icon when flag image fails to load', async () => {
      // Mock regions API response with valid country but simulate image load failure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          regions: [
            { id: 'test-region', label: 'Test Location', country: 'United States', capabilities: ['VPS'] },
          ],
        }),
      });

      const handleSelect = vi.fn();

      const { container } = renderWithAuth(
        <RegionSelector
          providerId="linode"
          selectedRegion="test-region"
          onSelect={handleSelect}
          token="mock-token"
        />
      );

      // Wait for component to render
      await waitFor(() => {
        const trigger = container.querySelector('[role="combobox"]');
        expect(trigger).toBeTruthy();
      });

      const trigger = container.querySelector('[role="combobox"]');

      // Find the flag image and trigger error event
      const flagImage = trigger?.querySelector('img[src*="flagcdn.com"]') as HTMLImageElement;
      if (flagImage) {
        // Simulate image load failure
        flagImage.dispatchEvent(new Event('error'));
      }

      // Wait for Globe icon to appear after image error
      await waitFor(() => {
        const globeIcon = trigger?.querySelector('svg[class*="lucide-globe"]');
        expect(globeIcon).toBeTruthy();
      });
    });
  });

  describe('Property 2.6: Short Dropdown Lists Continue to Display All Options', () => {
    /**
     * **Validates: Requirements 3.6**
     * 
     * This test verifies that dropdowns with few options (no scrollbar needed)
     * continue to display all options correctly without any issues.
     * 
     * EXPECTED: This test PASSES on unfixed code (baseline behavior)
     * AFTER FIX: This test PASSES (behavior preserved)
     */

    it('displays all options when list is short (no scrollbar)', async () => {
      const user = userEvent.setup();
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
        { value: 'nanode', label: 'Nanode', description: 'Lightweight VPS' },
        { value: 'dedicated', label: 'Dedicated CPU', description: 'Dedicated resources' },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Open the dropdown
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByText('Standard')).toBeTruthy();
      });

      // Verify all options are visible
      expect(screen.getByText('Standard')).toBeTruthy();
      expect(screen.getByText('Nanode')).toBeTruthy();
      expect(screen.getByText('Dedicated CPU')).toBeTruthy();

      // Verify options are clickable
      const standardOption = screen.getByText('Standard');
      await user.click(standardOption);

      // Verify selection works
      expect(handleChange).toHaveBeenCalledWith('standard');
    });
  });

  describe('Property 2.7: Dropdown Positioning and Styling Remain Unchanged', () => {
    /**
     * **Validates: Requirements 3.1**
     * 
     * This test verifies that dropdown popover positioning and styling remain unchanged.
     * The visual appearance and behavior must be preserved.
     * 
     * EXPECTED: This test PASSES on unfixed code (baseline behavior)
     * AFTER FIX: This test PASSES (behavior preserved)
     */

    it('renders dropdown with correct trigger button styling', () => {
      const mockOptions: SearchableOption[] = [
        { value: 'standard', label: 'Standard', description: 'General purpose VPS' },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value=""
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
          triggerIcon={<MapPin className="h-4 w-4" />}
        />
      );

      // Verify trigger button exists with correct role
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeTruthy();

      // Verify trigger button has correct aria attributes
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('type')).toBe('button');

      // Verify placeholder text is displayed
      expect(screen.getByText('Choose a category')).toBeTruthy();
    });

    it('displays selected option with icon in trigger button', () => {
      const mockOptions: SearchableOption[] = [
        { 
          value: 'standard', 
          label: 'Standard', 
          description: 'General purpose VPS',
          icon: <MapPin className="h-4 w-4" />
        },
      ];

      const handleChange = vi.fn();

      render(
        <SearchableOptionSelect
          value="standard"
          options={mockOptions}
          onChange={handleChange}
          placeholder="Choose a category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      );

      // Verify selected option label is displayed
      expect(screen.getByText('Standard')).toBeTruthy();

      // Verify description is displayed
      expect(screen.getByText('General purpose VPS')).toBeTruthy();
    });
  });
});
