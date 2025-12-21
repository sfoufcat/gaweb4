'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { Program, ProgramDay, ProgramCohort, ProgramTaskTemplate, ProgramHabitTemplate, ProgramWithStats } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Plus, Users, User, Calendar, DollarSign, Clock, Eye, EyeOff, Trash2, Edit2, ChevronRight } from 'lucide-react';

interface CoachProgramsTabProps {
  apiBasePath?: string;
}

type ProgramType = 'group' | 'individual';

export function CoachProgramsTab({ apiBasePath = '/api/coach/org-programs' }: CoachProgramsTabProps) {
  const [programs, setPrograms] = useState<ProgramWithStats[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithStats | null>(null);
  const [programDays, setProgramDays] = useState<ProgramDay[]>([]);
  const [programCohorts, setProgramCohorts] = useState<ProgramCohort[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // View mode: 'list' | 'days' | 'cohorts'
  const [viewMode, setViewMode] = useState<'list' | 'days' | 'cohorts'>('list');
  
  // Modal states
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isCohortModalOpen, setIsCohortModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editingCohort, setEditingCohort] = useState<ProgramCohort | null>(null);
  
  // Program form
  const [programFormData, setProgramFormData] = useState<{
    name: string;
    type: ProgramType;
    description: string;
    coverImageUrl: string;
    lengthDays: number;
    priceInCents: number;
    currency: string;
    squadCapacity: number;
    coachInSquads: boolean;
    isActive: boolean;
    isPublished: boolean;
    defaultHabits: ProgramHabitTemplate[];
  }>({
    name: '',
    type: 'group',
    description: '',
    coverImageUrl: '',
    lengthDays: 30,
    priceInCents: 0,
    currency: 'usd',
    squadCapacity: 10,
    coachInSquads: true,
    isActive: true,
    isPublished: false,
    defaultHabits: [],
  });
  
  // Cohort form
  const [cohortFormData, setCohortFormData] = useState<{
    name: string;
    startDate: string;
    endDate: string;
    enrollmentOpen: boolean;
    maxEnrollment: number | null;
  }>({
    name: '',
    startDate: '',
    endDate: '',
    enrollmentOpen: true,
    maxEnrollment: null,
  });
  
  // Day editor state
  const [dayFormData, setDayFormData] = useState<{
    title: string;
    summary: string;
    dailyPrompt: string;
    tasks: ProgramTaskTemplate[];
    habits: ProgramHabitTemplate[];
  }>({
    title: '',
    summary: '',
    dailyPrompt: '',
    tasks: [],
    habits: [],
  });
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmProgram, setDeleteConfirmProgram] = useState<Program | null>(null);
  const [deleteConfirmCohort, setDeleteConfirmCohort] = useState<ProgramCohort | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      setLoadingDetails(true);

      const response = await fetch(`${apiBasePath}/${programId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch program details');
      }

      const data = await response.json();
      setProgramDays(data.days || []);
      setProgramCohorts(data.cohorts || []);
      
      // Load first day data
      const day1 = data.days?.find((d: ProgramDay) => d.dayIndex === 1);
      if (day1) {
        setDayFormData({
          title: day1.title || '',
          summary: day1.summary || '',
          dailyPrompt: day1.dailyPrompt || '',
          tasks: day1.tasks || [],
          habits: day1.habits || [],
        });
      } else {
        setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [] });
      }
    } catch (err) {
      console.error('Error fetching program details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [apiBasePath]);

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
        summary: day.summary || '',
        dailyPrompt: day.dailyPrompt || '',
        tasks: day.tasks || [],
        habits: day.habits || [],
      });
    } else {
      setDayFormData({ title: '', summary: '', dailyPrompt: '', tasks: [], habits: [] });
    }
  }, [selectedDayIndex, programDays, selectedProgram]);

  const handleOpenProgramModal = (program?: Program) => {
    if (program) {
      setEditingProgram(program);
      setProgramFormData({
        name: program.name,
        type: program.type,
        description: program.description,
        coverImageUrl: program.coverImageUrl || '',
        lengthDays: program.lengthDays,
        priceInCents: program.priceInCents,
        currency: program.currency,
        squadCapacity: program.squadCapacity || 10,
        coachInSquads: program.coachInSquads !== false,
        isActive: program.isActive,
        isPublished: program.isPublished,
        defaultHabits: program.defaultHabits || [],
      });
    } else {
      setEditingProgram(null);
      setProgramFormData({
        name: '',
        type: 'group',
        description: '',
        coverImageUrl: '',
        lengthDays: 30,
        priceInCents: 0,
        currency: 'usd',
        squadCapacity: 10,
        coachInSquads: true,
        isActive: true,
        isPublished: false,
        defaultHabits: [],
      });
    }
    setSaveError(null);
    setIsProgramModalOpen(true);
  };

  const handleOpenCohortModal = (cohort?: ProgramCohort) => {
    if (cohort) {
      setEditingCohort(cohort);
      setCohortFormData({
        name: cohort.name,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        enrollmentOpen: cohort.enrollmentOpen,
        maxEnrollment: cohort.maxEnrollment || null,
      });
    } else {
      setEditingCohort(null);
      // Default to next month
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      const endDate = new Date(nextMonth);
      endDate.setDate(endDate.getDate() + (selectedProgram?.lengthDays || 30) - 1);
      
      setCohortFormData({
        name: nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startDate: nextMonth.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        enrollmentOpen: true,
        maxEnrollment: null,
      });
    }
    setSaveError(null);
    setIsCohortModalOpen(true);
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
      
      if (data.program) {
        setSelectedProgram(data.program);
        setViewMode('days');
      }
    } catch (err) {
      console.error('Error saving program:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCohort = async () => {
    if (!selectedProgram) return;
    
    try {
      setSaving(true);
      setSaveError(null);

      const url = editingCohort 
        ? `${apiBasePath}/${selectedProgram.id}/cohorts/${editingCohort.id}`
        : `${apiBasePath}/${selectedProgram.id}/cohorts`;
      
      const response = await fetch(url, {
        method: editingCohort ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cohortFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save cohort');
      }

      await fetchProgramDetails(selectedProgram.id);
      setIsCohortModalOpen(false);
    } catch (err) {
      console.error('Error saving cohort:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save cohort');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDay = async () => {
    if (!selectedProgram) return;
    
    try {
      setSaving(true);
      setSaveError(null);

      const response = await fetch(`${apiBasePath}/${selectedProgram.id}/days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayIndex: selectedDayIndex,
          ...dayFormData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save day');
      }

      await fetchProgramDetails(selectedProgram.id);
    } catch (err) {
      console.error('Error saving day:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save day');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgram = async () => {
    if (!deleteConfirmProgram) return;
    
    try {
      setDeleting(true);
      
      const response = await fetch(`${apiBasePath}/${deleteConfirmProgram.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete program');
      }

      setPrograms(prev => prev.filter(p => p.id !== deleteConfirmProgram.id));
      
      if (selectedProgram?.id === deleteConfirmProgram.id) {
        setSelectedProgram(null);
        setViewMode('list');
      }
      
      setDeleteConfirmProgram(null);
    } catch (err) {
      console.error('Error deleting program:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete program');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCohort = async () => {
    if (!deleteConfirmCohort || !selectedProgram) return;
    
    try {
      setDeleting(true);
      
      const response = await fetch(`${apiBasePath}/${selectedProgram.id}/cohorts/${deleteConfirmCohort.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete cohort');
      }

      await fetchProgramDetails(selectedProgram.id);
      setDeleteConfirmCohort(null);
    } catch (err) {
      console.error('Error deleting cohort:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete cohort');
    } finally {
      setDeleting(false);
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

  // Program default habits
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

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {viewMode === 'list' ? (
            <>
              <div>
                <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Programs
                </h2>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  Create and manage your coaching programs
                </p>
              </div>
              <Button 
                onClick={() => handleOpenProgramModal()}
                className="bg-[#a07855] hover:bg-[#8c6245] text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Program
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('list')}
                  className="text-[#a07855] hover:text-[#8c6245] font-albert text-sm"
                >
                  ← Back to Programs
                </button>
                <span className="text-[#e1ddd8] dark:text-[#262b35]">|</span>
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {selectedProgram?.name}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedProgram?.type === 'group' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                }`}>
                  {selectedProgram?.type === 'group' ? 'Group' : '1:1'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('days')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-albert ${
                    viewMode === 'days'
                      ? 'bg-[#a07855]/10 text-[#a07855]'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                  }`}
                >
                  Content
                </button>
                {selectedProgram?.type === 'group' && (
                  <button
                    onClick={() => setViewMode('cohorts')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-albert ${
                      viewMode === 'cohorts'
                        ? 'bg-[#a07855]/10 text-[#a07855]'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                    }`}
                  >
                    Cohorts
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        {viewMode === 'list' ? (
          // Programs List
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((program) => (
              <div
                key={program.id}
                className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                onClick={() => {
                  setSelectedProgram(program);
                  setViewMode('days');
                }}
              >
                {/* Cover Image */}
                <div className="h-32 bg-gradient-to-br from-[#a07855]/20 to-[#8c6245]/10 relative">
                  {program.coverImageUrl && (
                    <img 
                      src={program.coverImageUrl} 
                      alt={program.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {program.isPublished ? (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Live
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded-full flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Draft
                      </span>
                    )}
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      program.type === 'group' 
                        ? 'bg-blue-500 text-white'
                        : 'bg-purple-500 text-white'
                    }`}>
                      {program.type === 'group' ? <Users className="w-3 h-3 inline mr-1" /> : <User className="w-3 h-3 inline mr-1" />}
                      {program.type === 'group' ? 'Group' : '1:1'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                    {program.name}
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-2 mb-3">
                    {program.description || 'No description'}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {program.lengthDays} days
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatPrice(program.priceInCents)}
                    </span>
                    {program.type === 'group' && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {program.squadCapacity}/squad
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{program.activeEnrollments}</span> active
                      {program.cohortCount !== undefined && (
                        <> · <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{program.cohortCount}</span> cohorts</>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProgramModal(program);
                        }}
                        className="p-1.5 text-[#5f5a55] hover:text-[#a07855] rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmProgram(program);
                        }}
                        className="p-1.5 text-[#5f5a55] hover:text-red-500 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-[#5f5a55]" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {programs.length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="w-16 h-16 bg-[#a07855]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-[#a07855]" />
                </div>
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  No programs yet
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                  Create your first program to start enrolling clients
                </p>
                <Button 
                  onClick={() => handleOpenProgramModal()}
                  className="bg-[#a07855] hover:bg-[#8c6245] text-white"
                >
                  Create Program
                </Button>
              </div>
            )}
          </div>
        ) : viewMode === 'days' ? (
          // Day Editor
          <div className="flex gap-6">
            {/* Day Selector */}
            <div className="w-48 flex-shrink-0">
              <h3 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                Program Days
              </h3>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {Array.from({ length: selectedProgram?.lengthDays || 30 }, (_, i) => i + 1).map((day) => {
                  const hasContent = programDays.some(d => d.dayIndex === day && (d.tasks?.length > 0 || d.title));
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDayIndex(day)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-albert transition-colors ${
                        selectedDayIndex === day
                          ? 'bg-[#a07855]/10 text-[#a07855]'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
                      }`}
                    >
                      Day {day} {hasContent && <span className="text-green-500">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day Content */}
            <div className="flex-1 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Day {selectedDayIndex}
                    </h3>
                  </div>

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

                  {/* Daily Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                      Daily Prompt
                    </label>
                    <textarea
                      value={dayFormData.dailyPrompt}
                      onChange={(e) => setDayFormData({ ...dayFormData, dailyPrompt: e.target.value })}
                      placeholder="Enter a motivational message or tip for this day..."
                      rows={3}
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                    />
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mt-1">
                      This message will appear as a card on the user&apos;s home page for this day
                    </p>
                  </div>

                  {/* Tasks */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Tasks
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addTask}
                        className="text-[#a07855] hover:text-[#8c6245]"
                      >
                        + Add Task
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {dayFormData.tasks.map((task, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg">
                          <input
                            type="text"
                            value={task.label}
                            onChange={(e) => updateTask(index, { label: e.target.value })}
                            placeholder="Task title..."
                            className="flex-1 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                          />
                          <label className="flex items-center gap-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            <input
                              type="checkbox"
                              checked={task.isPrimary}
                              onChange={(e) => updateTask(index, { isPrimary: e.target.checked })}
                              className="rounded"
                            />
                            Focus
                          </label>
                          <button
                            onClick={() => removeTask(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {dayFormData.tasks.length === 0 && (
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert italic">
                          No tasks for this day
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Habits (Day 1) */}
                  {(selectedDayIndex === 1 || dayFormData.habits.length > 0) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          Default Habits {selectedDayIndex === 1 ? '(Day 1 sets program defaults)' : ''}
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={addHabit}
                          className="text-[#a07855] hover:text-[#8c6245]"
                        >
                          + Add Habit
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {dayFormData.habits.map((habit, index) => (
                          <div key={index} className="flex items-center gap-2 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg">
                            <input
                              type="text"
                              value={habit.title}
                              onChange={(e) => updateHabit(index, { title: e.target.value })}
                              placeholder="Habit title..."
                              className="flex-1 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                            />
                            <select
                              value={habit.frequency}
                              onChange={(e) => updateHabit(index, { frequency: e.target.value as 'daily' | 'weekday' | 'custom' })}
                              className="px-2 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekday">Weekday</option>
                            </select>
                            <button
                              onClick={() => removeHabit(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveDay}
                      disabled={saving}
                      className="bg-[#a07855] hover:bg-[#8c6245] text-white"
                    >
                      {saving ? 'Saving...' : 'Save Day'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Cohorts View (Group programs only)
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Manage time-based cohorts for this program
              </p>
              <Button 
                onClick={() => handleOpenCohortModal()}
                className="bg-[#a07855] hover:bg-[#8c6245] text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Cohort
              </Button>
            </div>

            <div className="space-y-3">
              {programCohorts.map((cohort) => (
                <div 
                  key={cohort.id}
                  className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {cohort.name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {cohort.startDate} → {cohort.endDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {cohort.currentEnrollment} enrolled
                          {cohort.maxEnrollment && ` / ${cohort.maxEnrollment} max`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        cohort.status === 'active' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : cohort.status === 'upcoming'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {cohort.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        cohort.enrollmentOpen
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {cohort.enrollmentOpen ? 'Open' : 'Closed'}
                      </span>
                      <button
                        onClick={() => handleOpenCohortModal(cohort)}
                        className="p-1.5 text-[#5f5a55] hover:text-[#a07855] rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmCohort(cohort)}
                        className="p-1.5 text-[#5f5a55] hover:text-red-500 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {programCohorts.length === 0 && (
                <div className="text-center py-8 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
                  <Calendar className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
                  <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                    No cohorts yet
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                    Create a cohort to start enrolling users in timed sessions
                  </p>
                  <Button 
                    onClick={() => handleOpenCohortModal()}
                    className="bg-[#a07855] hover:bg-[#8c6245] text-white"
                  >
                    Add First Cohort
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
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
                    {/* Type */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                        Program Type
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => !editingProgram && setProgramFormData({ ...programFormData, type: 'group' })}
                          disabled={!!editingProgram}
                          className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                            programFormData.type === 'group'
                              ? 'border-[#a07855] bg-[#a07855]/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
                          } ${editingProgram ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Users className="w-5 h-5 mx-auto mb-1 text-[#a07855]" />
                          <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">Group</span>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Cohorts & Squads</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => !editingProgram && setProgramFormData({ ...programFormData, type: 'individual' })}
                          disabled={!!editingProgram}
                          className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                            programFormData.type === 'individual'
                              ? 'border-[#a07855] bg-[#a07855]/5'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
                          } ${editingProgram ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <User className="w-5 h-5 mx-auto mb-1 text-[#a07855]" />
                          <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">1:1</span>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Individual coaching</p>
                        </button>
                      </div>
                      {editingProgram && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                          Type cannot be changed after creation
                        </p>
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={programFormData.name}
                        onChange={(e) => setProgramFormData({ ...programFormData, name: e.target.value })}
                        placeholder="e.g., Jazz Mastery Program"
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
                        placeholder="What will participants learn and achieve?"
                        rows={3}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                      />
                    </div>

                    {/* Cover Image URL */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Cover Image URL
                      </label>
                      <input
                        type="url"
                        value={programFormData.coverImageUrl}
                        onChange={(e) => setProgramFormData({ ...programFormData, coverImageUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Duration & Price */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Duration (days) *
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
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          value={programFormData.priceInCents / 100}
                          onChange={(e) => setProgramFormData({ ...programFormData, priceInCents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                          min={0}
                          step={0.01}
                          placeholder="0 = Free"
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                    </div>

                    {/* Group-specific settings */}
                    {programFormData.type === 'group' && (
                      <div className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg space-y-4">
                        <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          Squad Settings
                        </h4>
                        <div>
                          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                            Max members per squad
                          </label>
                          <input
                            type="number"
                            value={programFormData.squadCapacity}
                            onChange={(e) => setProgramFormData({ ...programFormData, squadCapacity: parseInt(e.target.value) || 10 })}
                            min={2}
                            max={100}
                            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                          />
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                            New squads auto-created when this limit is reached
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          <input
                            type="checkbox"
                            checked={programFormData.coachInSquads}
                            onChange={(e) => setProgramFormData({ ...programFormData, coachInSquads: e.target.checked })}
                            className="rounded"
                          />
                          Join squads as coach
                        </label>
                      </div>
                    )}

                    {/* Default Habits */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          Default Habits
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={addProgramHabit}
                          className="text-[#a07855] hover:text-[#8c6245]"
                        >
                          + Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {programFormData.defaultHabits.map((habit, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={habit.title}
                              onChange={(e) => updateProgramHabit(index, { title: e.target.value })}
                              placeholder="Habit title..."
                              className="flex-1 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                            />
                            <button
                              onClick={() => removeProgramHabit(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status checkboxes */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <input
                          type="checkbox"
                          checked={programFormData.isActive}
                          onChange={(e) => setProgramFormData({ ...programFormData, isActive: e.target.checked })}
                          className="rounded"
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <input
                          type="checkbox"
                          checked={programFormData.isPublished}
                          onChange={(e) => setProgramFormData({ ...programFormData, isPublished: e.target.checked })}
                          className="rounded"
                        />
                        Published (visible in Discover)
                      </label>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
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
                      disabled={saving || !programFormData.name}
                      className="bg-[#a07855] hover:bg-[#8c6245] text-white"
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

      {/* Cohort Create/Edit Modal */}
      <Transition appear show={isCohortModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !saving && setIsCohortModalOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                    {editingCohort ? 'Edit Cohort' : 'Add Cohort'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={cohortFormData.name}
                        onChange={(e) => setCohortFormData({ ...cohortFormData, name: e.target.value })}
                        placeholder="e.g., March 2025"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Start Date *
                        </label>
                        <input
                          type="date"
                          value={cohortFormData.startDate}
                          onChange={(e) => {
                            const startDate = new Date(e.target.value);
                            const endDate = new Date(startDate);
                            endDate.setDate(endDate.getDate() + (selectedProgram?.lengthDays || 30) - 1);
                            setCohortFormData({ 
                              ...cohortFormData, 
                              startDate: e.target.value,
                              endDate: endDate.toISOString().split('T')[0],
                            });
                          }}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={cohortFormData.endDate}
                          onChange={(e) => setCohortFormData({ ...cohortFormData, endDate: e.target.value })}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Max Enrollment (optional)
                      </label>
                      <input
                        type="number"
                        value={cohortFormData.maxEnrollment || ''}
                        onChange={(e) => setCohortFormData({ ...cohortFormData, maxEnrollment: parseInt(e.target.value) || null })}
                        min={1}
                        placeholder="No limit"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      <input
                        type="checkbox"
                        checked={cohortFormData.enrollmentOpen}
                        onChange={(e) => setCohortFormData({ ...cohortFormData, enrollmentOpen: e.target.checked })}
                        className="rounded"
                      />
                      Enrollment open
                    </label>

                    {saveError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400 font-albert">{saveError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setIsCohortModalOpen(false)}
                      disabled={saving}
                      className="border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveCohort}
                      disabled={saving || !cohortFormData.name || !cohortFormData.startDate}
                      className="bg-[#a07855] hover:bg-[#8c6245] text-white"
                    >
                      {saving ? 'Saving...' : (editingCohort ? 'Update' : 'Create')}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Program Confirmation Modal */}
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all">
                  <Dialog.Title className="font-albert text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                    Delete Program?
                  </Dialog.Title>
                  
                  <p className="text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Are you sure you want to delete <strong>{deleteConfirmProgram?.name}</strong>? 
                    This will delete all cohorts, days, and content. This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirmProgram(null)}
                      disabled={deleting}
                      className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteProgram}
                      disabled={deleting}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Cohort Confirmation Modal */}
      <Transition appear show={deleteConfirmCohort !== null} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setDeleteConfirmCohort(null)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all">
                  <Dialog.Title className="font-albert text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                    Delete Cohort?
                  </Dialog.Title>
                  
                  <p className="text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Are you sure you want to delete <strong>{deleteConfirmCohort?.name}</strong>? 
                    This will delete all associated squads and enrollments. This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirmCohort(null)}
                      disabled={deleting}
                      className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteCohort}
                      disabled={deleting}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
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

