'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  UniqueIdentifier,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronDown, Sparkles, ListPlus, Loader2 } from 'lucide-react';
import { TaskItem } from './TaskItem';
import { TaskSheetDefine } from './TaskSheetDefine';
import { TaskSheetManage } from './TaskSheetManage';
import { useTasks } from '@/hooks/useTasks';
import { useActiveEnrollment } from '@/hooks/useActiveEnrollment';
import type { Task } from '@/types';

// Empty drop zone component for when Daily Focus has no tasks
function EmptyFocusDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'empty-focus-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-full rounded-[20px] p-4 border-2 border-dashed transition-all duration-200 ${
        isOver 
          ? 'border-accent-secondary dark:border-[#b8896a] bg-accent-secondary/10 dark:bg-[#b8896a]/10 scale-[1.02]' 
          : 'border-[#e1ddd8] dark:border-[#262b35] bg-[#f3f1ef]/50 dark:bg-[#11141b]/50'
      }`}
    >
      <p className={`text-center font-albert text-[16px] tracking-[-0.5px] leading-[1.3] transition-colors ${
        isOver ? 'text-accent-secondary dark:text-[#b8896a]' : 'text-text-muted dark:text-[#7d8190]'
      }`}>
        {isOver ? 'Drop here to add to Daily Focus' : 'Drop task here'}
      </p>
    </div>
  );
}

interface ProgramPendingInfo {
  startsTomorrow: boolean;
  startsToday: boolean;
  programName: string;
}

interface DailyFocusSectionProps {
  isDayClosed?: boolean;
  onTasksChange?: () => void; // Called when tasks are completed/updated
  programPending?: ProgramPendingInfo | null; // When user has enrolled but tasks haven't started yet
  canLoadProgramTasks?: boolean; // Whether to show the pre-fill card
  programName?: string; // Program name for display in the pre-fill card
  onLoadProgramTasks?: () => Promise<void>; // Callback to trigger task sync
}

export function DailyFocusSection({ 
  isDayClosed = false, 
  onTasksChange, 
  programPending,
  canLoadProgramTasks,
  programName,
  onLoadProgramTasks,
}: DailyFocusSectionProps) {
  const today = new Date().toISOString().split('T')[0];
  const {
    focusTasks,
    backlogTasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    markComplete,
    reorderTasks,
    fetchTasks,
  } = useTasks({ date: today });
  
  // Get enrollment for program badge
  const { hasEnrollment, enrollment, program } = useActiveEnrollment();
  
  // Determine if we should show the starter program badge
  const programBadge = hasEnrollment && enrollment?.status === 'active' && program?.name
    ? `${program.name} Program`
    : null;
  
  // Get program name for program task tags
  const programDisplayName = program?.name || null;

  const [showBacklog, setShowBacklog] = useState(false); // Start with backlog hidden
  const [showDefineSheet, setShowDefineSheet] = useState(false);
  const [showManageSheet, setShowManageSheet] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [forceBacklog, setForceBacklog] = useState(false); // When true, new task goes to backlog
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [isLoadingProgramTasks, setIsLoadingProgramTasks] = useState(false);

  // Determine which list we're hovering over during drag
  const activeTask = activeId ? [...focusTasks, ...backlogTasks].find(t => t.id === activeId) : null;
  const overTask = overId ? [...focusTasks, ...backlogTasks].find(t => t.id === overId) : null;
  
  // Check if hovering over the empty focus drop zone
  const isOverEmptyFocusZone = overId === 'empty-focus-drop-zone';
  
  const isDraggingToFocus = activeTask && (
    (overTask && activeTask.listType === 'backlog' && overTask.listType === 'focus') ||
    (isOverEmptyFocusZone && activeTask.listType === 'backlog')
  );
  const isDraggingToBacklog = activeTask && overTask && activeTask.listType === 'focus' && overTask.listType === 'backlog';
  const canMoveToFocus = isDraggingToFocus && focusTasks.length < 3;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (helps with clicks)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  // Handle drag over - track which item we're hovering over
  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id ?? null);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Find the active and over tasks
    const activeTask = [...focusTasks, ...backlogTasks].find((t) => t.id === active.id);
    const overTask = [...focusTasks, ...backlogTasks].find((t) => t.id === over.id);

    // Handle dropping on empty focus zone
    if (over.id === 'empty-focus-drop-zone' && activeTask && activeTask.listType === 'backlog') {
      // Move task to focus list at position 0
      const updatedTask = { ...activeTask, listType: 'focus' as const, order: 0 };
      
      // Remove from backlog and reorder
      const reorderedBacklog = backlogTasks
        .filter(t => t.id !== active.id)
        .map((task, index) => ({
          ...task,
          order: index,
        }));
      
      // Update both lists
      reorderTasks([updatedTask, ...reorderedBacklog]);
      return;
    }

    if (!activeTask || !overTask) return;

    const activeListType = activeTask.listType;
    const overListType = overTask.listType;

    // If moving between lists
    if (activeListType !== overListType) {
      // If moving TO focus and focus already has 3 items (excluding the active task if it's already in focus)
      const currentFocusCount = focusTasks.filter(t => t.id !== active.id).length;
      if (overListType === 'focus' && currentFocusCount >= 3) {
        console.log('Cannot move to focus: limit of 3 tasks reached');
        return;
      }

      // Update the task's listType and reorder both lists
      const targetList = overListType === 'focus' ? focusTasks : backlogTasks;
      const targetIndex = targetList.findIndex(t => t.id === over.id);
      
      // Update active task's listType
      const updatedActiveTask = { ...activeTask, listType: overListType };
      
      // Insert into target list at the correct position
      const newTargetList = [...targetList];
      newTargetList.splice(targetIndex, 0, updatedActiveTask);
      
      // Reorder the target list
      const reorderedTargetList = newTargetList.map((task, index) => ({
        ...task,
        order: index,
      }));
      
      // Also reorder the source list (after removing the active task)
      const sourceList = activeListType === 'focus' ? focusTasks : backlogTasks;
      const reorderedSourceList = sourceList
        .filter(t => t.id !== active.id)
        .map((task, index) => ({
          ...task,
          order: index,
        }));
      
      // Combine all affected tasks for the update
      const allAffectedTasks = [...reorderedTargetList, ...reorderedSourceList];
      
      // Optimistically update UI
      reorderTasks(allAffectedTasks);
      return;
    }

    // Reordering within the same list
    const tasks = activeListType === 'focus' ? focusTasks : backlogTasks;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== newIndex) {
      const reordered = arrayMove(tasks, oldIndex, newIndex).map((task, index) => ({
        ...task,
        order: index,
      }));

      // Optimistically update UI immediately (no await)
      reorderTasks(reordered);
    }
  };

  // Handle clicking a task (opens Manage sheet)
  const handleTaskClick = (task: Task) => {
    // Allow clicking on both pending and completed tasks
    setSelectedTask(task);
    setShowManageSheet(true);
  };

  // Handle creating a new task
  const handleCreateTask = async (title: string, isPrivate: boolean) => {
    await createTask({ 
      title, 
      isPrivate,
      listType: forceBacklog ? 'backlog' : undefined, // Force to backlog when day is closed
    });
    setForceBacklog(false); // Reset after creating
  };

  // Handle editing an existing task
  const handleEditTask = async (title: string, isPrivate: boolean) => {
    if (!editingTask) return;
    await updateTask(editingTask.id, { title, isPrivate });
  };

  // Handle deleting a task
  const handleDeleteTask = async () => {
    if (!editingTask && !selectedTask) return;
    const taskToDelete = editingTask || selectedTask;
    if (taskToDelete) {
      await deleteTask(taskToDelete.id);
      setEditingTask(null);
      setSelectedTask(null);
    }
  };

  // Handle completing a task
  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    await markComplete(selectedTask.id);
    // Notify parent that tasks changed (for story data refresh)
    onTasksChange?.();
  };

  // Handle marking task as incomplete (undo completion)
  const handleMarkIncomplete = async () => {
    if (!selectedTask) return;
    await updateTask(selectedTask.id, { status: 'pending' });
    // Notify parent that tasks changed (for story data refresh)
    onTasksChange?.();
  };

  // Open edit sheet from manage sheet
  const handleEditFromManage = () => {
    setEditingTask(selectedTask);
    setShowManageSheet(false);
    setShowDefineSheet(true);
  };

  // Open add task sheet
  const handleAddTask = (toBacklog: boolean = false) => {
    setEditingTask(null);
    setForceBacklog(toBacklog);
    setShowDefineSheet(true);
  };

  // Handle loading program tasks
  const handleLoadProgramTasks = async () => {
    if (!onLoadProgramTasks || isLoadingProgramTasks) return;
    
    setIsLoadingProgramTasks(true);
    try {
      await onLoadProgramTasks();
      // Tasks will auto-refresh via useTasks hook after sync
    } catch (error) {
      console.error('Error loading program tasks:', error);
    } finally {
      setIsLoadingProgramTasks(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
              Daily Focus
            </h2>
            {/* Track-specific starter program badge (shown during loading if available) */}
            {programBadge && (
              <span className="px-2.5 py-1 bg-[#f3f1ef] dark:bg-[#1d222b] text-text-secondary dark:text-[#b2b6c2] rounded-full font-sans text-[11px] font-medium whitespace-nowrap">
                {programBadge}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-surface rounded-[20px] p-4 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 flex-shrink-0" />
              <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
              Daily Focus
            </h2>
            {/* Track-specific starter program badge */}
            {programBadge && (
              <span className="px-2.5 py-1 bg-[#f3f1ef] dark:bg-[#1d222b] text-text-secondary dark:text-[#b2b6c2] rounded-full font-sans text-[11px] font-medium whitespace-nowrap">
                {programBadge}
              </span>
            )}
          </div>
          {!isDayClosed && (
            <button
              onClick={() => handleAddTask(false)}
              className="font-sans text-[12px] text-accent-secondary leading-[1.2] hover:text-accent-tertiary transition-colors"
            >
              Add
            </button>
          )}
        </div>

        {/* Program Starts Pending Card */}
        {programPending && (programPending.startsTomorrow || programPending.startsToday) && (
          <div className="mb-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-albert text-[16px] font-semibold text-amber-800 dark:text-amber-200 tracking-[-0.5px]">
                  {programPending.startsTomorrow 
                    ? 'Your program will begin tomorrow' 
                    : 'Complete your morning check-in to start!'}
                </p>
                <p className="font-sans text-[13px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                  {programPending.startsTomorrow 
                    ? 'Complete your morning check-in tomorrow and your tasks will be ready for you.'
                    : `Your ${programPending.programName} tasks are ready — just complete check-in first.`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {/* Unified DndContext for both Focus and Backlog */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Focus Tasks (max 3, draggable) */}
            <div className={`space-y-2 transition-all duration-200 ${
              isDraggingToFocus 
                ? canMoveToFocus
                  ? 'ring-2 ring-accent-secondary ring-offset-2 rounded-[24px] p-2 bg-accent-secondary/5'
                  : 'ring-2 ring-red-300 ring-offset-2 rounded-[24px] p-2 bg-red-50/30'
                : ''
            }`}>
              {isDraggingToFocus && !canMoveToFocus && (
                <div className="text-center py-2 px-4 bg-red-50 text-red-600 text-sm rounded-lg mb-2 animate-in fade-in duration-200">
                  Daily Focus is full (max 3 tasks)
                </div>
              )}
              
              <SortableContext
                items={focusTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {focusTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onClick={() => handleTaskClick(task)}
                    isDraggable={true}
                    trackDisplayName={programDisplayName || undefined}
                    onTaskUpdate={fetchTasks}
                  />
                ))}
              </SortableContext>

              {/* Empty Focus Drop Zone - shown when dragging from backlog and focus is empty */}
              {focusTasks.length === 0 && activeId && activeTask?.listType === 'backlog' && (
                <EmptyFocusDropZone isOver={isOverEmptyFocusZone} />
              )}

              {/* Load Program Tasks Card - shown when user has program but no tasks and missed check-in */}
              {canLoadProgramTasks && focusTasks.length === 0 && backlogTasks.length === 0 && !isDayClosed && (
                <div className="mb-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center flex-shrink-0">
                      <ListPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-albert text-[16px] font-semibold text-emerald-800 dark:text-emerald-200 tracking-[-0.5px]">
                        Load today&apos;s program tasks
                      </p>
                      <p className="font-sans text-[13px] text-emerald-700/80 dark:text-emerald-300/70 mt-0.5">
                        {programName ? `Get your ${programName} tasks for today` : 'Pre-fill your daily tasks from the program'}
                      </p>
                    </div>
                    <button
                      onClick={handleLoadProgramTasks}
                      disabled={isLoadingProgramTasks}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-full font-sans text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoadingProgramTasks ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load tasks'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Day Closed Message or Add Task Row */}
              {isDayClosed ? (
                <div className="w-full bg-[#f3f1ef] dark:bg-[#171b22] rounded-[20px] p-4 flex items-center justify-center">
                  <p className="font-albert text-[16px] text-text-secondary dark:text-[#b2b6c2] tracking-[-0.5px] leading-[1.4] text-center">
                    You&apos;ve closed the day. Time to rest, so you can do great tomorrow.
                  </p>
                </div>
              ) : focusTasks.length < 3 && !activeId ? (
                <button
                  onClick={() => handleAddTask(false)}
                  className="w-full bg-[#f3f1ef] dark:bg-[#11141b] rounded-[20px] p-4 flex items-center justify-center text-text-muted dark:text-[#7d8190] hover:text-text-secondary dark:hover:text-[#b2b6c2] transition-colors"
                >
                  <span className="font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3]">
                    Add task
                  </span>
                </button>
              ) : null}
            </div>

            {/* Backlog Toggle - always show when day is closed or when backlog has tasks */}
            {(backlogTasks.length > 0 || isDayClosed) && (
              <>
                <button
                  onClick={() => setShowBacklog(!showBacklog)}
                  className="w-full flex items-center justify-center gap-1 py-2 hover:opacity-70 transition-opacity"
                >
                  <span className="font-sans text-[12px] text-text-secondary">
                    {showBacklog ? 'Show less' : 'Show more'}
                  </span>
                  <div className={`transition-transform duration-300 ${showBacklog ? 'rotate-180' : 'rotate-0'}`}>
                    <ChevronDown className="w-4 h-4 text-text-secondary" strokeWidth={2} />
                  </div>
                </button>

                {/* Backlog Section with smooth animation */}
                <div className={`transition-all duration-300 ease-in-out ${
                  showBacklog ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                }`}>
                  <div className="space-y-2 pt-2 animate-in fade-in duration-300">
                    {/* Backlog Divider */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
                      <span className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[1.2]">
                        Backlog
                      </span>
                      <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
                    </div>

                    {/* Backlog Tasks (now draggable!) */}
                    <div className={`space-y-2 transition-all duration-200 ${
                      isDraggingToBacklog 
                        ? 'ring-2 ring-accent-secondary ring-offset-2 rounded-[24px] p-2 bg-accent-secondary/5 -mx-1 px-3'
                        : ''
                    }`}>
                      {isDraggingToBacklog && (
                        <div className="text-center py-2 px-4 bg-accent-secondary/10 text-accent-secondary text-sm rounded-lg mb-2 animate-in fade-in duration-200">
                          Moving to Backlog
                        </div>
                      )}
                      
                      <SortableContext
                        items={backlogTasks.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {backlogTasks.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            onClick={() => handleTaskClick(task)}
                            isDraggable={true}
                            trackDisplayName={programDisplayName || undefined}
                            onTaskUpdate={fetchTasks}
                          />
                        ))}
                      </SortableContext>

                      {/* Add task to backlog button - always adds to backlog */}
                      {!activeId && (
                        <button
                          onClick={() => handleAddTask(true)}
                          className="w-full bg-[#f3f1ef] dark:bg-[#11141b] rounded-[20px] p-4 flex items-center justify-center text-text-muted dark:text-[#7d8190] hover:text-text-secondary dark:hover:text-[#b2b6c2] transition-colors"
                        >
                          <span className="font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3]">
                            Add task
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Drag Overlay - shows a preview of what's being dragged */}
            <DragOverlay>
              {activeId ? (
                (() => {
                  const draggedTask = [...focusTasks, ...backlogTasks].find(t => t.id === activeId);
                  return draggedTask ? (
                    <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 flex items-center gap-2 shadow-lg dark:shadow-black/40 opacity-90 rotate-2">
                      <div className="text-text-muted dark:text-[#7d8190]">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="5" r="1" />
                          <circle cx="9" cy="12" r="1" />
                          <circle cx="9" cy="19" r="1" />
                          <circle cx="15" cy="5" r="1" />
                          <circle cx="15" cy="12" r="1" />
                          <circle cx="15" cy="19" r="1" />
                        </svg>
                      </div>
                      <div className="w-6 h-6 rounded-md border border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-center flex-shrink-0 bg-white dark:bg-[#181d26]" />
                      <p className="flex-1 font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] text-text-primary dark:text-[#f5f5f8]">
                        {draggedTask.title}
                      </p>
                    </div>
                  ) : null;
                })()
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Define/Edit Sheet */}
      <TaskSheetDefine
        isOpen={showDefineSheet}
        onClose={() => {
          setShowDefineSheet(false);
          setEditingTask(null);
        }}
        onSave={editingTask ? handleEditTask : handleCreateTask}
        onDelete={editingTask ? handleDeleteTask : undefined}
        task={editingTask}
      />

      {/* Manage Sheet */}
      {selectedTask && (
        <TaskSheetManage
          isOpen={showManageSheet}
          onClose={() => {
            setShowManageSheet(false);
            setSelectedTask(null);
          }}
          onComplete={handleCompleteTask}
          onNotYet={selectedTask.status === 'completed' ? handleMarkIncomplete : () => {}}
          onEdit={handleEditFromManage}
          onDelete={handleDeleteTask}
          task={selectedTask}
        />
      )}
    </>
  );
}

