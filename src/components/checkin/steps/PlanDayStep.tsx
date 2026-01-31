'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '@/hooks/useTasks';
import { useDailyFocusLimit } from '@/hooks/useDailyFocusLimit';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { TaskSheetDefine } from '@/components/tasks/TaskSheetDefine';
import type { Task } from '@/types';
import type { PlanDayStepProps } from './types';

/**
 * RocketLaunchAnimation - 3 rockets with smoke and sparkles
 */
const RocketLaunchAnimation = ({ onComplete }: { onComplete: () => void }) => {
  return (
    <div
      className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden bg-[#faf8f6] dark:bg-[#05070b]"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-full h-full relative">
        <div className="w-full h-full animate-page-fade-in">
          {/* Multiple rockets */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute text-[60px] md:text-[80px]"
              style={{
                left: `${30 + i * 20}%`,
                bottom: 0,
              }}
              initial={{
                y: 100,
                opacity: 0,
                rotate: 0,
              }}
              animate={{
                y: [100, -200, -800],
                opacity: [0, 1, 1, 0],
                rotate: [0, -5, 5, 0],
              }}
              transition={{
                duration: 1.8,
                delay: i * 0.15,
                ease: [0.4, 0, 0.2, 1],
                times: [0, 0.2, 0.8, 1],
              }}
              onAnimationComplete={() => {
                if (i === 1) onComplete();
              }}
            >
              🚀
            </motion.div>
          ))}

          {/* Smoke/exhaust particles */}
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={`smoke-${i}`}
              className="absolute w-4 h-4 md:w-6 md:h-6 rounded-full bg-[#e1ddd8]"
              style={{
                left: `${25 + Math.random() * 50}%`,
                bottom: 50,
              }}
              initial={{
                y: 0,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{
                y: [0, 50, 150],
                opacity: [0, 0.6, 0],
                scale: [0.5, 1.5, 2],
                x: [0, (Math.random() - 0.5) * 100],
              }}
              transition={{
                duration: 1.5,
                delay: 0.2 + i * 0.08,
                ease: 'easeOut',
              }}
            />
          ))}

          {/* Sparkles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute"
              style={{
                left: `${20 + Math.random() * 60}%`,
                bottom: `${10 + Math.random() * 30}%`,
                width: 8 + Math.random() * 8,
                height: 8 + Math.random() * 8,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.8,
                delay: 0.3 + i * 0.05,
                ease: 'easeOut',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <path
                  d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                  fill="rgba(255, 180, 50, 0.9)"
                />
              </svg>
            </motion.div>
          ))}

          {/* Center text */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <h2 className="font-albert text-[32px] md:text-[48px] font-medium text-[#1a1a1a] dark:text-white tracking-[-2px]">
              Let&apos;s go! 🔥
            </h2>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

/**
 * EmptyFocusDropZone - Drop zone when Daily Focus has no tasks
 */
function EmptyFocusDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'empty-focus-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-full rounded-[20px] p-4 border-2 border-dashed transition-all duration-200 ${
        isOver
          ? 'border-[#8b7355] bg-[#8b7355]/10 scale-[1.02]'
          : 'border-[#e1ddd8] dark:border-[#262b35] bg-[#f3f1ef]/50 dark:bg-[#1d222b]/50'
      }`}
    >
      <p className={`text-center font-albert text-[16px] tracking-[-0.5px] leading-[1.3] transition-colors ${
        isOver ? 'text-[#8b7355]' : 'text-[#a7a39e] dark:text-[#7d8190]'
      }`}>
        {isOver ? 'Drop here to add to Daily Focus' : 'Drag a task here'}
      </p>
    </div>
  );
}

/**
 * SortableTaskItem - Draggable task item
 */
function SortableTaskItem({
  task,
  onClick,
  onEdit,
  onDelete,
  showControls = false,
  showDragHandle = true,
}: {
  task: Task;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showControls?: boolean;
  showDragHandle?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-[#171b22] rounded-[20px] p-4 flex items-center gap-2 ${
        task.status === 'completed' ? 'opacity-60' : ''
      }`}
      {...(showDragHandle ? {} : attributes)}
      {...(showDragHandle ? {} : listeners)}
    >
      {/* Drag handle for backlog only */}
      {showDragHandle && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] touch-none"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}

      {/* Task title */}
      <button
        onClick={onClick}
        className={`flex-1 text-left font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] ${
          task.status === 'completed'
            ? 'line-through text-[#a7a39e] dark:text-[#7d8190]'
            : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
        } ${!showDragHandle ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {task.title}
      </button>

      {/* Controls for focus tasks */}
      {showControls && task.listType === 'focus' && (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-[#a7a39e] dark:text-[#7d8190] hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * PlanDayStep - Full drag-drop task planner
 *
 * Extracted from /src/app/checkin/morning/plan-day/page.tsx
 * Features:
 * - Daily Focus (max 3) + Backlog sections with @dnd-kit
 * - Rocket animation on completion (3 rockets, 15 smoke, 20 sparkles)
 * - Program task syncing from /api/programs/sync
 * - TaskSheetDefine for add/edit
 */
export function PlanDayStep({ config, onComplete }: PlanDayStepProps) {
  const router = useRouter();
  const { isDemoMode, openSignupModal } = useDemoMode();
  const today = new Date().toISOString().split('T')[0];
  const {
    focusTasks,
    backlogTasks,
    isLoading,
    error: taskError,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    fetchTasks,
  } = useTasks({ date: today });

  // Get org's daily focus limit
  const { limit: focusLimit } = useDailyFocusLimit();

  // Local error state for displaying and auto-dismissing errors
  const [displayError, setDisplayError] = useState<string | null>(null);

  // Show task errors when they occur
  useEffect(() => {
    if (taskError) {
      setDisplayError(taskError);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setDisplayError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [taskError]);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingTo, setAddingTo] = useState<'focus' | 'backlog'>('focus');
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRocketAnimation, setShowRocketAnimation] = useState(false);
  const [showFocusFullWarning, setShowFocusFullWarning] = useState(false);

  // Track if we've synced program tasks for this session
  const hasSyncedProgram = useRef(false);

  // Sync program tasks on page load
  useEffect(() => {
    if (hasSyncedProgram.current) return;
    hasSyncedProgram.current = true;

    const syncProgramTasks = async () => {
      try {
        const response = await fetch('/api/programs/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          console.error('[PLAN_DAY] Failed to sync program tasks');
          return;
        }

        const result = await response.json();

        if (result.tasksCreated > 0) {
          console.log(`[PLAN_DAY] Synced ${result.tasksCreated} program tasks for day ${result.currentDayIndex}`);
          await fetchTasks();
        }
      } catch (error) {
        console.error('[PLAN_DAY] Error syncing program tasks:', error);
      }
    };

    syncProgramTasks();
  }, [fetchTasks]);

  // Determine drag state for visual feedback
  const activeTask = activeId ? [...focusTasks, ...backlogTasks].find(t => t.id === activeId) : null;
  const overTask = overId ? [...focusTasks, ...backlogTasks].find(t => t.id === overId) : null;
  const isOverEmptyFocusZone = overId === 'empty-focus-drop-zone';
  const isDraggingToFocus = activeTask && (
    (overTask && activeTask.listType === 'backlog' && overTask.listType === 'focus') ||
    (isOverEmptyFocusZone && activeTask.listType === 'backlog')
  );
  const canMoveToFocus = isDraggingToFocus && focusTasks.length < focusLimit;

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag events
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const allTasks = [...focusTasks, ...backlogTasks];
    const draggedTask = allTasks.find((t) => t.id === active.id);
    const targetTask = allTasks.find((t) => t.id === over.id);

    // Handle dropping on empty focus zone
    if (over.id === 'empty-focus-drop-zone' && draggedTask && draggedTask.listType === 'backlog') {
      const updatedTask = { ...draggedTask, listType: 'focus' as const, order: 0 };

      const reorderedBacklog = backlogTasks
        .filter(t => t.id !== active.id)
        .map((task, index) => ({
          ...task,
          order: index,
        }));

      reorderTasks([updatedTask, ...reorderedBacklog]);
      return;
    }

    if (!draggedTask || !targetTask) return;

    // If moving between lists
    if (draggedTask.listType !== targetTask.listType) {
      if (targetTask.listType === 'focus' && focusTasks.length >= focusLimit) {
        setShowFocusFullWarning(true);
        setTimeout(() => setShowFocusFullWarning(false), 3000);
        return;
      }

      const targetList = targetTask.listType === 'focus' ? focusTasks : backlogTasks;
      const targetIndex = targetList.findIndex(t => t.id === over.id);

      const updatedDraggedTask = { ...draggedTask, listType: targetTask.listType };
      const newTargetList = [...targetList];
      newTargetList.splice(targetIndex, 0, updatedDraggedTask);

      const reorderedTargetList = newTargetList.map((task, index) => ({
        ...task,
        order: index,
      }));

      const sourceList = draggedTask.listType === 'focus' ? focusTasks : backlogTasks;
      const reorderedSourceList = sourceList
        .filter(t => t.id !== active.id)
        .map((task, index) => ({
          ...task,
          order: index,
        }));

      reorderTasks([...reorderedTargetList, ...reorderedSourceList]);
      return;
    }

    // Reordering within same list
    const tasks = draggedTask.listType === 'focus' ? focusTasks : backlogTasks;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== newIndex) {
      const reordered = arrayMove(tasks, oldIndex, newIndex).map((task, index) => ({
        ...task,
        order: index,
      }));
      reorderTasks(reordered);
    }
  };

  // Handle task actions
  const handleAddTask = (listType: 'focus' | 'backlog') => {
    setAddingTo(listType);
    setEditingTask(null);
    setShowAddSheet(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowAddSheet(true);
  };

  const handleDeleteTask = async (task: Task) => {
    await deleteTask(task.id);
  };

  const handleSaveTask = async (title: string, isPrivate: boolean, priority?: 'high' | 'medium' | 'low') => {
    if (editingTask) {
      await updateTask(editingTask.id, { title, isPrivate, priority });
    } else {
      await createTask({
        title,
        isPrivate,
        priority,
        listType: addingTo,
      });
    }
  };

  const handleStartDay = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (!isDemoMode) {
        await fetch('/api/checkin/morning', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasksPlanned: true,
            completedAt: new Date().toISOString(),
          }),
        });

        // Send squad notification (fire and forget)
        fetch('/api/checkin/morning/squad-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch((error) => {
          console.error('Squad notification failed:', error);
        });
      }

      setShowRocketAnimation(true);
    } catch (error) {
      console.error('Error completing check-in:', error);
      setIsSubmitting(false);
    }
  };

  const handleAnimationComplete = useCallback(() => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    // Navigate directly to dashboard instead of continuing flow
    // This skips any remaining steps (like "Ready to go")
    router.push('/');
  }, [isDemoMode, openSignupModal, router]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Rocket Animation */}
      <AnimatePresence>
        {showRocketAnimation && (
          <RocketLaunchAnimation onComplete={handleAnimationComplete} />
        )}
      </AnimatePresence>

      <div className="h-full w-full flex flex-col overflow-y-auto bg-[#faf8f6] dark:bg-[#05070b]">
        <div className="flex-1 w-full max-w-[650px] mx-auto px-6 pt-8 md:pt-12 pb-32">
          {/* Header */}
          <div className="mb-10">
            <h1 className="font-albert text-[36px] md:text-[42px] text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2]">
              {(config.heading as string) || 'Plan your day'}
            </h1>
          </div>

          {/* Error Alert - shown when task operations fail */}
          {displayError && (
            <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-200 animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-sm font-sans">{displayError}</span>
              <button
                onClick={() => setDisplayError(null)}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Focus Tasks */}
            <div className={`space-y-2 mb-4 transition-all duration-200 ${
              isDraggingToFocus
                ? canMoveToFocus
                  ? 'ring-2 ring-[#8b7355] ring-offset-2 dark:ring-offset-[#05070b] rounded-[24px] p-2 bg-[#8b7355]/5'
                  : 'ring-2 ring-red-300 ring-offset-2 dark:ring-offset-[#05070b] rounded-[24px] p-2 bg-red-50/30 dark:bg-red-900/20'
                : ''
            }`}>
              {/* Warning when focus is full */}
              {(showFocusFullWarning || (isDraggingToFocus && !canMoveToFocus)) && (
                <div className="text-center py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-[16px] mb-2 animate-in fade-in duration-200 border border-red-100 dark:border-red-800">
                  Daily Focus is full (max 3 tasks)
                </div>
              )}

              <SortableContext
                items={focusTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {focusTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onClick={() => {}}
                    onEdit={() => handleEditTask(task)}
                    onDelete={() => handleDeleteTask(task)}
                    showControls={true}
                    showDragHandle={false}
                  />
                ))}
              </SortableContext>

              {/* Empty Focus Drop Zone */}
              {focusTasks.length === 0 && activeId && activeTask?.listType === 'backlog' && (
                <EmptyFocusDropZone isOver={isOverEmptyFocusZone} />
              )}

              {/* Add focus task button */}
              {focusTasks.length < focusLimit && !activeId && (
                <button
                  onClick={() => handleAddTask('focus')}
                  className="w-full bg-[#f3f1ef] dark:bg-[#1d222b] rounded-[20px] p-4 flex items-center justify-center"
                >
                  <span className="font-albert text-[18px] font-semibold text-[#a7a39e] dark:text-[#7d8190] tracking-[-1px] leading-[1.3]">
                    Add task
                  </span>
                </button>
              )}
            </div>

            {/* Backlog divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
              <span className="font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190]">Backlog</span>
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
            </div>

            {/* Backlog Tasks */}
            <div className="space-y-2">
              <SortableContext
                items={backlogTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {backlogTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onClick={() => {}}
                    onEdit={() => handleEditTask(task)}
                    onDelete={() => handleDeleteTask(task)}
                    showDragHandle={true}
                  />
                ))}
              </SortableContext>

              {/* Add backlog task button */}
              <button
                onClick={() => handleAddTask('backlog')}
                className="w-full bg-[#f3f1ef] dark:bg-[#1d222b] rounded-[20px] p-4 flex items-center justify-center"
              >
                <span className="font-albert text-[18px] font-semibold text-[#a7a39e] dark:text-[#7d8190] tracking-[-1px] leading-[1.3]">
                  Add task
                </span>
              </button>
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeTask && (
                <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 flex items-center gap-2 shadow-lg opacity-90 rotate-2">
                  <GripVertical className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                  <span className="font-albert text-[18px] font-semibold tracking-[-1px] leading-[1.3] text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {activeTask.title}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Start Day button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#faf8f6] dark:bg-[#05070b] px-6 pb-8 md:pb-12 pt-6">
          <button
            onClick={handleStartDay}
            disabled={isSubmitting}
            className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Starting...' : 'Start Day'}
          </button>
        </div>

        {/* Add/Edit Task Sheet */}
        <TaskSheetDefine
          isOpen={showAddSheet}
          onClose={() => {
            setShowAddSheet(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={editingTask ? async () => {
            await handleDeleteTask(editingTask);
            setShowAddSheet(false);
            setEditingTask(null);
          } : undefined}
          task={editingTask}
        />
      </div>
    </>
  );
}
