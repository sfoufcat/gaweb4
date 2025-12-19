'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMessageInputContext, useChannelStateContext, useChatContext } from 'stream-chat-react';
import { 
  useVoiceRecorder, 
  VoiceRecordingButton, 
  VoiceRecordingUI, 
  PermissionDeniedUI,
  RecordingErrorUI 
} from './VoiceRecorder';
import { AttachmentMenu } from './AttachmentMenu';
import { PollComposer } from './PollComposer';
import { trackSquadInteraction } from '@/hooks/useAlignment';
import type { MessageResponse } from 'stream-chat';
import type { PollFormData, ChatPollState } from '@/types/poll';

/**
 * CustomMessageInput Component
 * 
 * Custom message input for Growth Addicts chat:
 * - Clean, pill-shaped input container
 * - Plus button on left (for attachments)
 * - Text input in center
 * - Microphone/Send button on right (mic when empty, send when text present)
 * - Voice recording support (uses useVoiceRecorder hook)
 * - Edit mode support
 * - Thread reply support (sends messages to thread when in thread context)
 */

export function CustomMessageInput() {
  const { 
    handleSubmit, 
    textareaRef,
  } = useMessageInputContext();
  
  // Get thread from channel state - this is the parent message when in a thread
  const { channel, thread } = useChannelStateContext();
  const { client } = useChatContext();
  
  const [localText, setLocalText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ type: string; image_url?: string; asset_url?: string; title?: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<MessageResponse | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaLocalRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  // Handle voice recording completion
  const handleVoiceRecordingComplete = useCallback(async (audioBlob: Blob) => {
    if (channel) {
      try {
        // Create a file from the blob
        const file = new File([audioBlob], `voice-message-${Date.now()}.webm`, {
          type: audioBlob.type,
        });
        
        // Upload to Stream
        const response = await channel.sendFile(file);
        
        if (response.file) {
          // Send message with audio attachment
          // If we're in a thread context, include the parent_id to send to thread
          await channel.sendMessage({
            text: '',
            attachments: [{
              type: 'audio',
              asset_url: response.file,
              title: 'Voice message',
            }],
            ...(thread?.id ? { parent_id: thread.id } : {}),
          });
          
          // Track squad interaction for alignment (only for squad channels)
          if (channel.id?.startsWith('squad-')) {
            trackSquadInteraction().catch(console.error);
          }
        }
      } catch (error) {
        console.error('Failed to send voice message:', error);
      }
    }
  }, [channel, thread?.id]);

  // Use the voice recorder hook - this keeps recording state alive regardless of UI changes
  const {
    isRecording,
    duration,
    permissionDenied,
    recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
    dismissPermissionDenied,
    dismissRecordingError,
  } = useVoiceRecorder({ onRecordingComplete: handleVoiceRecordingComplete });

  const hasText = localText.trim().length > 0;
  const hasContent = hasText || attachments.length > 0;
  const isEditing = editingMessage !== null;

  // Listen for edit events from CustomMessage
  useEffect(() => {
    const handleEditEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: MessageResponse }>;
      const messageToEdit = customEvent.detail?.message;
      if (messageToEdit) {
        setEditingMessage(messageToEdit);
        setLocalText(messageToEdit.text || '');
        // Focus the textarea
        setTimeout(() => {
          textareaLocalRef.current?.focus();
        }, 0);
      }
    };
    
    // Listen on document for bubbled events
    document.addEventListener('stream-edit-message', handleEditEvent);
    return () => document.removeEventListener('stream-edit-message', handleEditEvent);
  }, []);

  // Sync local text with textarea ref when it changes externally
  useEffect(() => {
    if (textareaRef?.current) {
      const syncText = () => {
        setLocalText(textareaRef.current?.value || '');
      };
      
      const textarea = textareaRef.current;
      textarea.addEventListener('input', syncText);
      return () => textarea.removeEventListener('input', syncText);
    }
  }, [textareaRef]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaLocalRef.current) {
      textareaLocalRef.current.style.height = 'auto';
      textareaLocalRef.current.style.height = `${Math.min(textareaLocalRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [localText, adjustTextareaHeight]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setLocalText(newText);
    
    // Update the Stream textarea ref
    if (textareaRef?.current) {
      textareaRef.current.value = newText;
      // Dispatch input event to notify Stream
      textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setLocalText('');
    if (textareaRef?.current) {
      textareaRef.current.value = '';
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!hasContent || !channel || !client) return;
    
    try {
      if (isEditing && editingMessage) {
        // Update existing message using client.updateMessage
        await client.updateMessage({
          id: editingMessage.id,
          text: localText.trim(),
        });
        setEditingMessage(null);
      } else {
        // Send new message with attachments
        // If we're in a thread context, include the parent_id to send to thread
        await channel.sendMessage({
          text: localText.trim(),
          attachments: attachments.length > 0 ? attachments : undefined,
          ...(thread?.id ? { parent_id: thread.id } : {}),
        });
        
        // Track squad interaction for alignment (only for squad channels)
        // Squad channel IDs start with 'squad-'
        if (channel.id?.startsWith('squad-')) {
          trackSquadInteraction().catch(console.error);
        }
      }
      
      // Clear state
      setLocalText('');
      setAttachments([]);
      if (textareaRef?.current) {
        textareaRef.current.value = '';
      }
      if (textareaLocalRef.current) {
        textareaLocalRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send/edit message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cancel edit on Escape
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      handleCancelEdit();
      return;
    }
    
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (hasContent) {
        handleFormSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  // Handle file selection and upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !channel) return;
    
    setIsUploading(true);
    
    try {
      const newAttachments: typeof attachments = [];
      
      for (const file of Array.from(files)) {
        // Upload to Stream
        const response = await channel.sendFile(file);
        
        if (response.file) {
          const isImage = file.type.startsWith('image/');
          newAttachments.push({
            type: isImage ? 'image' : 'file',
            ...(isImage ? { image_url: response.file } : { asset_url: response.file }),
            title: file.name,
          });
        }
      }
      
      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove an attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle gallery selection
  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  // Handle camera capture
  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  // Handle poll creation
  const handlePollSubmit = async (pollData: PollFormData) => {
    if (!channel) return;

    try {
      // Create poll via API
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: pollData.question,
          options: pollData.options,
          settings: {
            activeTill: pollData.settings.activeTill.toISOString(),
            anonymous: pollData.settings.anonymous,
            multipleAnswers: pollData.settings.multipleAnswers,
            participantsCanAddOptions: pollData.settings.participantsCanAddOptions,
          },
          channelId: channel.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create poll');
      }

      const { poll } = await response.json() as { poll: ChatPollState };

      // Send message with poll reference (using custom field names to avoid Stream's native polls)
      await channel.sendMessage({
        text: `📊 ${pollData.question}`,
        ga_poll_id: poll.id,
        ga_poll_kind: 'growthaddicts_poll',
        ga_poll_data: poll,
        ...(thread?.id ? { parent_id: thread.id } : {}),
      } as any);

      // Track squad interaction for alignment
      if (channel.id?.startsWith('squad-')) {
        trackSquadInteraction().catch(console.error);
      }
    } catch (error) {
      console.error('Failed to create poll:', error);
      throw error;
    }
  };

  // If recording, show the voice recorder UI (full width)
  if (isRecording) {
    return (
      <div className="bg-[#faf8f6] dark:bg-[#0a0c10] px-4 py-3">
        <div className="bg-[#f3f1ef] dark:bg-[#1e222a] rounded-3xl px-3 py-2">
          <VoiceRecordingUI
            duration={duration}
            onStop={stopRecording}
            onCancel={cancelRecording}
          />
        </div>
      </div>
    );
  }

  // If permission denied, show error
  if (permissionDenied) {
    return (
      <div className="bg-[#faf8f6] dark:bg-[#0a0c10] px-4 py-3">
        <PermissionDeniedUI onDismiss={dismissPermissionDenied} />
      </div>
    );
  }

  // If recording error (e.g., browser compatibility), show error
  if (recordingError) {
    return (
      <div className="bg-[#faf8f6] dark:bg-[#0a0c10] px-4 py-3">
        <RecordingErrorUI message={recordingError} onDismiss={dismissRecordingError} />
      </div>
    );
  }

  return (
    <form ref={containerRef} onSubmit={handleFormSubmit} className="bg-[#faf8f6] dark:bg-[#0a0c10] px-4 py-3">
      {/* Edit Mode Indicator */}
      {isEditing && (
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2 text-[#a07855] dark:text-[#b8896a]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-[13px] font-medium font-['Geist']">Editing message</span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="text-[13px] text-[#a7a39e] hover:text-[#5f5a55] dark:text-[#7d8190] dark:hover:text-[#b2b6c2] font-['Geist']"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((attachment, index) => (
            <div key={index} className="relative">
              {attachment.type === 'image' && attachment.image_url ? (
                <img
                  src={attachment.image_url}
                  alt={attachment.title || 'Attachment'}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              ) : (
                <div className="w-16 h-16 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#5f5a55] dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                aria-label="Remove attachment"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className={`flex items-center gap-2 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-3xl px-3 py-2 transition-all duration-200 ${
        isFocused ? 'ring-2 ring-[#a07855]/20 dark:ring-[#b8896a]/20' : ''
      } ${isEditing ? 'ring-2 ring-[#a07855]/30 dark:ring-[#b8896a]/30' : ''}`}>
        {/* Plus/Attachment Button - Hidden during edit */}
        {!isEditing && (
          <div className="relative">
            <button
              ref={plusButtonRef}
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] transition-colors disabled:opacity-50"
              aria-label="Add attachment"
              disabled={isUploading}
            >
              {isUploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
            
            {/* Attachment Menu */}
            <AttachmentMenu
              isOpen={showAttachmentMenu}
              onClose={() => setShowAttachmentMenu(false)}
              onGalleryClick={handleGalleryClick}
              onCameraClick={handleCameraClick}
              onPollClick={() => {
                setShowAttachmentMenu(false);
                setShowPollComposer(true);
              }}
              anchorRef={plusButtonRef}
            />
          </div>
        )}
        {/* Gallery file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
        />
        {/* Camera capture input */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text Input */}
        <div className="flex-1 min-w-0 flex items-center">
          <textarea
            ref={textareaLocalRef}
            value={localText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isEditing ? "Edit your message..." : "Type a message..."}
            rows={1}
            className="w-full bg-transparent border-none outline-none resize-none font-['Geist'] text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#8c8c8c] dark:placeholder-[#7d8190] leading-[24px]"
            style={{ 
              height: 'auto',
              minHeight: '24px',
              maxHeight: '120px',
            }}
          />
        </div>

        {/* Hidden textarea for Stream integration */}
        <textarea
          ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
          className="hidden"
          aria-hidden="true"
        />

        {/* Send/Update or Mic Button */}
        {hasContent ? (
          <button
            type="submit"
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-lg disabled:opacity-50 ${
              isEditing 
                ? 'bg-[#a07855] hover:bg-[#8d6548] dark:bg-[#b8896a] dark:hover:bg-[#a07855]' 
                : 'bg-[#2c2520] hover:bg-[#1a1a1a] dark:bg-[#b8896a] dark:hover:bg-[#a07855]'
            }`}
            aria-label={isEditing ? "Update message" : "Send message"}
            disabled={isUploading}
          >
            {isEditing ? (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                <path d="M8.33339 11.6667L17.5001 2.5M8.33339 11.6667L11.2501 17.5C11.2866 17.5798 11.3453 17.6474 11.4192 17.6948C11.493 17.7422 11.579 17.7674 11.6667 17.7674C11.7545 17.7674 11.8404 17.7422 11.9143 17.6948C11.9881 17.6474 12.0468 17.5798 12.0834 17.5L17.5001 2.5M8.33339 11.6667L2.50006 8.75C2.42027 8.71344 2.35266 8.65474 2.30526 8.58088C2.25786 8.50701 2.23267 8.4211 2.23267 8.33333C2.23267 8.24557 2.25786 8.15965 2.30526 8.08579C2.35266 8.01193 2.42027 7.95323 2.50006 7.91667L17.5001 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        ) : !isEditing ? (
          <VoiceRecordingButton onClick={startRecording} />
        ) : null}
      </div>
      
      {/* Poll Composer Modal */}
      <PollComposer
        isOpen={showPollComposer}
        onClose={() => setShowPollComposer(false)}
        onSubmit={handlePollSubmit}
      />
    </form>
  );
}

export default CustomMessageInput;
