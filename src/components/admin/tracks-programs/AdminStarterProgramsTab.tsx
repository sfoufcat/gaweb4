'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { StarterProgram, StarterProgramDay, UserTrack, ProgramTaskTemplate, ProgramHabitTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Circle, Target, X, Plus, ListTodo, Repeat, ChevronDown, Clock } from 'lucide-react';

const TRACK_LABELS: Record<UserTrack, string> = {
  content_creator: 'Content Creator',
  saas: 'SaaS',
  coach_consultant: 'Coach',
  ecom: 'E-Commerce',
  agency: 'Agency',
  community_builder: 'Community',
  general: 'General',
};

const VALID_TRACKS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'community_builder',
  'general',
];

interface AdminStarterProgramsTabProps {
  apiBasePath?: string;
}

export function AdminStarterProgramsTab({ apiBasePath = '/api/admin/starter-programs' }: AdminStarterProgramsTabProps) {
  const [programs, setPrograms] = useState<StarterProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<StarterProgram | null>(null);
  const [programDays, setProgramDays] = useState<StarterProgramDay[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [loadingDays, setLoadingDays] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<StarterProgram | null>(null);
  const [programFormData, setProgramFormData] = useState<{
    track: UserTrack;
    slug: string;
    name: string;
    description: string;
    lengthDays: number;
    programOrder: number;
    isDefaultForTrack: boolean;
    isActive: boolean;
    defaultHabits: ProgramHabitTemplate[];
  }>({
    track: 'general',
    slug: '',
    name: '',
    description: '',
    lengthDays: 30,
    programOrder: 1,
    isDefaultForTrack: false,
    isActive: true,
    defaultHabits: [],
  });
  
  // Day editor state
  const [dayFormData, setDayFormData] = useState<{
    title: string;
    tasks: ProgramTaskTemplate[];
    habits: ProgramHabitTemplate[];
  }>({
    title: '',
    tasks: [],
    habits: [],
  });
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [deleteConfirmProgram, setDeleteConfirmProgram] = useState<StarterProgram | null>(null);

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiBasePath);
      if (!response.ok) {
        throw new Error('Failed to fetch programs');
      }

      const data = await response.json();
      setPrograms(data.programs || []);
    } catch (err) {
      console.error('Error fetching programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch programs');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  const fetchProgramDetails = useCallback(async (programId: string) => {
    try {
      setLoadingDays(true);

      const response = await fetch(`${apiBasePath}/${programId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch program details');
      }

      const data = await response.json();
      setProgramDays(data.days || []);
      
      // Load first day data
      const day1 = data.days?.find((d: StarterProgramDay) => d.dayIndex === 1);
      if (day1) {
        setDayFormData({
          title: day1.title || '',
          tasks: day1.tasks || [],
          habits: day1.habits || [],
        });
      } else {
        setDayFormData({ title: '', tasks: [], habits: [] });
      }
    } catch (err) {
      console.error('Error fetching program details:', err);
    } finally {
      setLoadingDays(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    if (selectedProgram) {
      fetchProgramDetails(selectedProgram.id);
      setSelectedDayIndex(1);
    }
  }, [selectedProgram, fetchProgramDetails]);

  // Load day data when day index changes
  useEffect(() => {
    if (!selectedProgram || !programDays.length) return;
    
    const day = programDays.find(d => d.dayIndex === selectedDayIndex);
    if (day) {
      setDayFormData({
        title: day.title || '',
        tasks: day.tasks || [],
        habits: day.habits || [],
      });
    } else {
      setDayFormData({ title: '', tasks: [], habits: [] });
    }
  }, [selectedDayIndex, programDays, selectedProgram]);

  const handleOpenProgramModal = (program?: StarterProgram) => {
    if (program) {
      setEditingProgram(program);
      setProgramFormData({
        track: program.track,
        slug: program.slug,
        name: program.name,
        description: program.description,
        lengthDays: program.lengthDays,
        programOrder: program.programOrder || 1,
        isDefaultForTrack: program.isDefaultForTrack,
        isActive: program.isActive !== false,
        defaultHabits: program.defaultHabits || [],
      });
    } else {
      setEditingProgram(null);
      setProgramFormData({
        track: 'general',
        slug: '',
        name: '',
        description: '',
        lengthDays: 30,
        programOrder: 1,
        isDefaultForTrack: false,
        isActive: true,
        defaultHabits: [],
      });
    }
    setSaveError(null);
    setIsProgramModalOpen(true);
  };

  const handleSaveProgram = async () => {
    try {
      setSaving(true);
      setSaveError(null);

      const url = editingProgram 
        ? `${apiBasePath}/${editingProgram.id}`
        : apiBasePath;
      
      const response = await fetch(url, {
        method: editingProgram ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(programFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save program');
      }

      await fetchPrograms();
      setIsProgramModalOpen(false);
      
      // Select the newly created/updated program
      if (data.program) {
        setSelectedProgram(data.program);
      }
    } catch (err) {
      console.error('Error saving program:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDay = async () => {
    if (!selectedProgram) return;
    
    try {
      setSaving(true);
      setSaveError(null);

      const response = await fetch(`${apiBasePath}/${selectedProgram.id}/days/${selectedDayIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dayFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save day');
      }

      // Refresh program details
      await fetchProgramDetails(selectedProgram.id);
    } catch (err) {
      console.error('Error saving day:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save day');
    } finally {
      setSaving(false);
    }
  };

  // Task management
  const addTask = () => {
    setDayFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { label: '', isPrimary: true }],
    }));
  };

  const updateTask = (index: number, updates: Partial<ProgramTaskTemplate>) => {
    setDayFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => i === index ? { ...task, ...updates } : task),
    }));
  };

  const removeTask = (index: number) => {
    setDayFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  };

  // Habit management
  const addHabit = () => {
    setDayFormData(prev => ({
      ...prev,
      habits: [...prev.habits, { title: '', frequency: 'daily' }],
    }));
  };

  const updateHabit = (index: number, updates: Partial<ProgramHabitTemplate>) => {
    setDayFormData(prev => ({
      ...prev,
      habits: prev.habits.map((habit, i) => i === index ? { ...habit, ...updates } : habit),
    }));
  };

  const removeHabit = (index: number) => {
    setDayFormData(prev => ({
      ...prev,
      habits: prev.habits.filter((_, i) => i !== index),
    }));
  };

  // Program default habits management
  const addProgramHabit = () => {
    setProgramFormData(prev => ({
      ...prev,
      defaultHabits: [...prev.defaultHabits, { title: '', frequency: 'daily' }],
    }));
  };

  const updateProgramHabit = (index: number, updates: Partial<ProgramHabitTemplate>) => {
    setProgramFormData(prev => ({
      ...prev,
      defaultHabits: prev.defaultHabits.map((habit, i) => i === index ? { ...habit, ...updates } : habit),
    }));
  };

  const removeProgramHabit = (index: number) => {
    setProgramFormData(prev => ({
      ...prev,
      defaultHabits: prev.defaultHabits.filter((_, i) => i !== index),
    }));
  };

  // Delete program
  const handleDeleteProgram = async (program: StarterProgram) => {
    try {
      setDeletingProgramId(program.id);
      
      const response = await fetch(`${apiBasePath}/${program.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete program');
      }

      // Remove from local state
      setPrograms(prev => prev.filter(p => p.id !== program.id));
      
      // Clear selection if deleted program was selected
      if (selectedProgram?.id === program.id) {
        setSelectedProgram(null);
        setProgramDays([]);
      }
      
      setDeleteConfirmProgram(null);
    } catch (err) {
      console.error('Error deleting program:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete program');
    } finally {
      setDeletingProgramId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading programs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-albert font-semibold mb-2">Error</p>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">{error}</p>
        <Button 
          onClick={fetchPrograms} 
          className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-6 h-[600px]">
        {/* Left: Programs List */}
        <div className="w-1/3 border-r border-[#e1ddd8] dark:border-[#262b35] pr-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Programs
            </h3>
            <Button 
              onClick={() => handleOpenProgramModal()}
              size="sm"
              className="bg-brand-accent hover:bg-brand-accent/90 text-white"
            >
              Add
            </Button>
          </div>
          
          <div className="space-y-2 overflow-y-auto max-h-[520px]">
            {programs.map((program) => (
              <div
                key={program.id}
                onClick={() => setSelectedProgram(program)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedProgram?.id === program.id
                    ? 'bg-brand-accent/10 border border-brand-accent/30'
                    : 'hover:bg-[#faf8f6] dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {program.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProgramModal(program);
                      }}
                      className="text-brand-accent hover:text-brand-accent/90 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmProgram(program);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {TRACK_LABELS[program.track]}
                  </span>
                  <span className="text-xs font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    • {program.lengthDays} days
                  </span>
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                    Order {program.programOrder || 1}
                  </span>
                  {program.isDefaultForTrack && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                      Default
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {programs.length === 0 && (
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-center py-8">
                No programs yet. Create your first program.
              </p>
            )}
          </div>
        </div>

        {/* Right: Day Editor */}
        <div className="w-2/3 overflow-y-auto">
          {selectedProgram ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {selectedProgram.name}
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Edit daily content templates
                  </p>
                </div>
              </div>

              {/* Day Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                  Select Day
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDayIndex}
                    onChange={(e) => setSelectedDayIndex(parseInt(e.target.value))}
                    className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                  >
                    {Array.from({ length: selectedProgram.lengthDays }, (_, i) => i + 1).map((day) => {
                      const hasContent = programDays.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title));
                      return (
                        <option key={day} value={day}>
                          Day {day} {hasContent ? '✓' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    of {selectedProgram.lengthDays} days
                  </span>
                </div>
              </div>

              {loadingDays ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Day Title */}
                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                      Day Theme (optional)
                    </label>
                    <input
                      type="text"
                      value={dayFormData.title}
                      onChange={(e) => setDayFormData({ ...dayFormData, title: e.target.value })}
                      placeholder="e.g., Clarify your niche"
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                    />
                  </div>

                  {/* Tasks */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Tasks
                      </label>
                      <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                        Up to 3 recommended
                      </span>
                    </div>
                    <div className="space-y-2">
                      {dayFormData.tasks.map((task, index) => (
                        <div 
                          key={index} 
                          className="group relative flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:shadow-sm hover:border-[#d4d0cb] dark:hover:border-[#313746] transition-all duration-200"
                        >
                          {/* Task Icon */}
                          <div className="w-5 h-5 rounded-full border-2 border-[#e1ddd8] dark:border-[#3d4351] flex-shrink-0" />
                          
                          {/* Input */}
                          <input
                            type="text"
                            value={task.label}
                            onChange={(e) => updateTask(index, { label: e.target.value })}
                            placeholder="What should they accomplish?"
                            className="flex-1 bg-transparent border-none outline-none font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                          />
                          
                          {/* Time Estimate */}
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f3f1ef] dark:bg-[#1d222b]">
                            <Clock className="w-3 h-3 text-[#a7a39e] dark:text-[#7d8190]" />
                            <input
                              type="number"
                              value={task.estimatedMinutes || ''}
                              onChange={(e) => updateTask(index, { estimatedMinutes: parseInt(e.target.value) || undefined })}
                              placeholder="min"
                              className="w-10 bg-transparent border-none outline-none font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] text-center"
                            />
                          </div>
                          
                          {/* Focus Toggle */}
                          <button
                            type="button"
                            onClick={() => updateTask(index, { isPrimary: !task.isPrimary })}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              task.isPrimary 
                                ? 'bg-brand-accent/15 text-brand-accent dark:bg-brand-accent/20 dark:text-brand-accent' 
                                : 'bg-[#f3f1ef] dark:bg-[#1d222b] text-[#5f5a55] dark:text-[#7d8190] hover:bg-[#eae7e3] dark:hover:bg-[#262b35]'
                            }`}
                          >
                            <Target className="w-3.5 h-3.5" />
                            Focus
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => removeTask(index)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      {/* Empty State */}
                      {dayFormData.tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
                          <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center mb-3">
                            <ListTodo className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                          </div>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">No tasks yet</p>
                          <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                            Add tasks to guide users through this day
                          </p>
                        </div>
                      )}
                      
                      {/* Add Task Button */}
                      <button
                        type="button"
                        onClick={addTask}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-brand-accent hover:border-brand-accent/50 hover:bg-brand-accent/5 dark:hover:bg-brand-accent/90/10 transition-all duration-200 font-albert font-medium text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Task
                      </button>
                    </div>
                  </div>

                  {/* Habits (only show for Day 1 or if habits exist) */}
                  {(selectedDayIndex === 1 || dayFormData.habits.length > 0) && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <label className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            Default Habits
                          </label>
                          {selectedDayIndex === 1 && (
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">
                              Day 1 sets program defaults
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {dayFormData.habits.map((habit, index) => (
                          <div 
                            key={index} 
                            className="group relative flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:shadow-sm hover:border-[#d4d0cb] dark:hover:border-[#313746] transition-all duration-200"
                          >
                            {/* Habit Icon - Dashed Ring */}
                            <div className="w-5 h-5 rounded-full border-2 border-dashed border-brand-accent/40 dark:border-brand-accent/40 flex-shrink-0" />
                            
                            {/* Input */}
                            <input
                              type="text"
                              value={habit.title}
                              onChange={(e) => updateHabit(index, { title: e.target.value })}
                              placeholder="What habit should they build?"
                              className="flex-1 bg-transparent border-none outline-none font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                            />
                            
                            {/* Frequency Dropdown */}
                            <div className="relative">
                              <select
                                value={habit.frequency}
                                onChange={(e) => updateHabit(index, { frequency: e.target.value as 'daily' | 'weekday' | 'custom' })}
                                className="appearance-none pl-3 pr-8 py-1.5 bg-[#f3f1ef] dark:bg-[#1d222b] border-none rounded-lg text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30"
                              >
                                <option value="daily">Daily</option>
                                <option value="weekday">Weekday</option>
                                <option value="custom">Custom</option>
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a7a39e] dark:text-[#7d8190] pointer-events-none" />
                            </div>
                            
                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => removeHabit(index)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        
                        {/* Empty State */}
                        {dayFormData.habits.length === 0 && selectedDayIndex === 1 && (
                          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
                            <div className="w-12 h-12 rounded-full bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center mb-3">
                              <Repeat className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                            </div>
                            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">No habits yet</p>
                            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                              Add default habits for this program
                            </p>
                          </div>
                        )}
                        
                        {/* Add Habit Button */}
                        <button
                          type="button"
                          onClick={addHabit}
                          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-brand-accent hover:border-brand-accent/50 hover:bg-brand-accent/5 dark:hover:bg-brand-accent/90/10 transition-all duration-200 font-albert font-medium text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Habit
                        </button>
                      </div>
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600 font-albert">{saveError}</p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveDay}
                      disabled={saving}
                      className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                    >
                      {saving ? 'Saving...' : 'Save Day'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Select a program to edit its daily content
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Program Create/Edit Modal */}
      <Transition appear show={isProgramModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !saving && setIsProgramModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                  <Dialog.Title className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                    {editingProgram ? 'Edit Program' : 'Create Program'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    {/* Track */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Track
                      </label>
                      <select
                        value={programFormData.track}
                        onChange={(e) => setProgramFormData({ ...programFormData, track: e.target.value as UserTrack })}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      >
                        {VALID_TRACKS.map((track) => (
                          <option key={track} value={track}>
                            {TRACK_LABELS[track]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Slug */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Slug
                      </label>
                      <input
                        type="text"
                        value={programFormData.slug}
                        onChange={(e) => setProgramFormData({ ...programFormData, slug: e.target.value })}
                        placeholder="e.g., creator-30-day-start"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={programFormData.name}
                        onChange={(e) => setProgramFormData({ ...programFormData, name: e.target.value })}
                        placeholder="e.g., Content Creator Starter Program"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Description
                      </label>
                      <textarea
                        value={programFormData.description}
                        onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                        placeholder="Short description of the program..."
                        rows={2}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                      />
                    </div>

                    {/* Length */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Duration (days)
                      </label>
                      <input
                        type="number"
                        value={programFormData.lengthDays}
                        onChange={(e) => setProgramFormData({ ...programFormData, lengthDays: parseInt(e.target.value) || 30 })}
                        min={1}
                        max={365}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Program Order */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Program Order *
                      </label>
                      <input
                        type="number"
                        value={programFormData.programOrder}
                        onChange={(e) => setProgramFormData({ ...programFormData, programOrder: parseInt(e.target.value) || 1 })}
                        min={1}
                        max={99}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                        Order in sequence (1 = first program for new users, 2 = next after completing order 1, etc.)
                      </p>
                    </div>

                    {/* Default Habits */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          Default Habits
                        </label>
                      </div>
                      <div className="space-y-2">
                        {programFormData.defaultHabits.map((habit, index) => (
                          <div 
                            key={index} 
                            className="group relative flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:border-[#d4d0cb] dark:hover:border-[#313746] transition-all duration-200"
                          >
                            {/* Habit Icon - Dashed Ring */}
                            <div className="w-4 h-4 rounded-full border-2 border-dashed border-brand-accent/40 dark:border-brand-accent/40 flex-shrink-0" />
                            
                            {/* Input */}
                            <input
                              type="text"
                              value={habit.title}
                              onChange={(e) => updateProgramHabit(index, { title: e.target.value })}
                              placeholder="What habit should they build?"
                              className="flex-1 bg-transparent border-none outline-none font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
                            />
                            
                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => removeProgramHabit(index)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        
                        {/* Add Habit Button */}
                        <button
                          type="button"
                          onClick={addProgramHabit}
                          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-brand-accent hover:border-brand-accent/50 hover:bg-brand-accent/5 dark:hover:bg-brand-accent/90/10 transition-all duration-200 font-albert font-medium text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Habit
                        </button>
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <BrandedCheckbox
                          checked={programFormData.isDefaultForTrack}
                          onChange={(checked) => setProgramFormData({ ...programFormData, isDefaultForTrack: checked })}
                        />
                        <span className="cursor-pointer" onClick={() => setProgramFormData({ ...programFormData, isDefaultForTrack: !programFormData.isDefaultForTrack })}>Default for track</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <BrandedCheckbox
                          checked={programFormData.isActive}
                          onChange={(checked) => setProgramFormData({ ...programFormData, isActive: checked })}
                        />
                        <span className="cursor-pointer" onClick={() => setProgramFormData({ ...programFormData, isActive: !programFormData.isActive })}>Active</span>
                      </div>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-albert">{saveError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setIsProgramModalOpen(false)}
                      disabled={saving}
                      className="border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveProgram}
                      disabled={saving || !programFormData.slug || !programFormData.name}
                      className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                    >
                      {saving ? 'Saving...' : (editingProgram ? 'Update' : 'Create')}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation Modal */}
      <Transition appear show={deleteConfirmProgram !== null} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setDeleteConfirmProgram(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="font-albert text-xl text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] mb-3">
                    Delete Program?
                  </Dialog.Title>
                  
                  <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Are you sure you want to delete <strong>{deleteConfirmProgram?.name}</strong>? This will also delete all program days and tasks. This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirmProgram(null)}
                      disabled={deletingProgramId !== null}
                      className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => deleteConfirmProgram && handleDeleteProgram(deleteConfirmProgram)}
                      disabled={deletingProgramId !== null}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deletingProgramId ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

