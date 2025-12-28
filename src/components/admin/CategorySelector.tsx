'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * CategorySelector Component
 * 
 * Dropdown selector for article categories with ability to create new categories.
 * Categories are organization-specific and stored in org settings.
 * 
 * Used in admin content forms (articles) to select or create categories.
 */

interface CategorySelectorProps {
  value: string;
  onChange: (category: string) => void;
  placeholder?: string;
  className?: string;
  /** API endpoint to fetch/create categories. Defaults to /api/coach/org-article-categories */
  categoriesApiEndpoint?: string;
}

export function CategorySelector({
  value,
  onChange,
  placeholder = 'Select or create category...',
  className = '',
  categoriesApiEndpoint = '/api/coach/org-article-categories',
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(categoriesApiEndpoint);
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [categoriesApiEndpoint]);

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Filter categories by search term
  const filteredCategories = categories.filter(c =>
    c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if the search term matches an existing category exactly
  const exactMatch = categories.some(
    c => c.toLowerCase() === searchTerm.trim().toLowerCase()
  );

  // Show "Create new" option if search term doesn't exactly match any existing category
  const showCreateOption = searchTerm.trim() && !exactMatch;

  const handleSelect = (category: string) => {
    onChange(category);
    setOpen(false);
    setSearchTerm('');
  };

  const handleCreateCategory = async () => {
    const newCategory = searchTerm.trim();
    if (!newCategory || isCreating) return;

    setIsCreating(true);
    try {
      const response = await fetch(categoriesApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local categories list
        setCategories(data.categories || [...categories, newCategory]);
        // Select the new category
        onChange(newCategory);
        setOpen(false);
        setSearchTerm('');
      } else {
        const error = await response.json();
        console.error('Failed to create category:', error);
        alert(error.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('Failed to create category');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[40px] font-normal text-left"
          >
            {value ? (
              <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{value}</span>
            ) : (
              <span className="text-text-secondary dark:text-[#7d8190]">
                {loading ? 'Loading categories...' : placeholder}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or create category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && showCreateOption) {
                  e.preventDefault();
                  handleCreateCategory();
                }
              }}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a] dark:focus:ring-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto p-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                Loading...
              </div>
            ) : (
              <>
                {/* Create new category option */}
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={isCreating}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left text-[#a07855] dark:text-[#b8896a] font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {isCreating ? 'Creating...' : `Create "${searchTerm.trim()}"`}
                    </span>
                  </button>
                )}

                {/* Existing categories */}
                {filteredCategories.length === 0 && !showCreateOption ? (
                  <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                    {searchTerm ? 'No categories found.' : 'No categories yet. Type to create one.'}
                  </div>
                ) : (
                  filteredCategories.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleSelect(category)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left ${
                        value === category ? 'bg-[#f3f1ef] dark:bg-[#262b35]' : ''
                      }`}
                    >
                      <div className={`flex h-4 w-4 items-center justify-center rounded border flex-shrink-0 ${
                        value === category
                          ? 'bg-[#a07855] border-[#a07855] dark:border-[#b8896a]'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {value === category && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <span className="flex-1 text-[#1a1a1a] dark:text-[#f5f5f8]">{category}</span>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}





