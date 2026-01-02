'use client';

import { useState } from 'react';
import { DEMO_USER } from '@/lib/demo-utils';
import { DemoSignupModal } from '@/components/demo/DemoSignupModal';
import { MessageSquare, Send, Search, Phone, Video, MoreVertical, Smile, Paperclip, Check, CheckCheck } from 'lucide-react';

interface DemoMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: Date;
  isRead: boolean;
}

interface DemoConversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
  messages: DemoMessage[];
}

// Generate demo conversations
const generateDemoConversations = (): DemoConversation[] => {
  const now = new Date();
  
  return [
    {
      id: 'conv-1',
      name: 'Sarah Miller',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
      lastMessage: 'Thank you so much for the session today! I feel so motivated.',
      lastMessageTime: new Date(now.getTime() - 15 * 60 * 1000),
      unreadCount: 2,
      isOnline: true,
      messages: [
        {
          id: 'msg-1-1',
          senderId: 'sarah',
          senderName: 'Sarah Miller',
          senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
          text: "Hi! I wanted to discuss my progress on the habit tracker.",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'msg-1-2',
          senderId: DEMO_USER.id,
          senderName: DEMO_USER.name,
          senderAvatar: DEMO_USER.imageUrl,
          text: "Of course! I've noticed you've been consistent with your morning routine. That's fantastic progress!",
          timestamp: new Date(now.getTime() - 1.5 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'msg-1-3',
          senderId: 'sarah',
          senderName: 'Sarah Miller',
          senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
          text: "Yes! I've managed to wake up at 6am for 14 days straight now 🎉",
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'msg-1-4',
          senderId: DEMO_USER.id,
          senderName: DEMO_USER.name,
          senderAvatar: DEMO_USER.imageUrl,
          text: "That's amazing! Let's talk about adding a second habit to your routine in our next session.",
          timestamp: new Date(now.getTime() - 45 * 60 * 1000),
          isRead: true
        },
        {
          id: 'msg-1-5',
          senderId: 'sarah',
          senderName: 'Sarah Miller',
          senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
          text: "Thank you so much for the session today! I feel so motivated.",
          timestamp: new Date(now.getTime() - 15 * 60 * 1000),
          isRead: false
        }
      ]
    },
    {
      id: 'conv-2',
      name: 'Michael Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      lastMessage: "I'll review the worksheet before our call tomorrow",
      lastMessageTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      unreadCount: 0,
      isOnline: false,
      messages: [
        {
          id: 'msg-2-1',
          senderId: DEMO_USER.id,
          senderName: DEMO_USER.name,
          senderAvatar: DEMO_USER.imageUrl,
          text: "Hi Michael! I've shared the goal-setting worksheet with you. Please take a look before our next session.",
          timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'msg-2-2',
          senderId: 'michael',
          senderName: 'Michael Chen',
          senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
          text: "I'll review the worksheet before our call tomorrow",
          timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          isRead: true
        }
      ]
    },
    {
      id: 'conv-3',
      name: 'Emma Thompson',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      lastMessage: "The meditation exercises have been really helpful",
      lastMessageTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      unreadCount: 0,
      isOnline: true,
      messages: [
        {
          id: 'msg-3-1',
          senderId: 'emma',
          senderName: 'Emma Thompson',
          senderAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
          text: "The meditation exercises have been really helpful",
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          isRead: true
        }
      ]
    },
    {
      id: 'conv-4',
      name: 'James Wilson',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      lastMessage: "Looking forward to starting the new program!",
      lastMessageTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      unreadCount: 0,
      isOnline: false,
      messages: [
        {
          id: 'msg-4-1',
          senderId: 'james',
          senderName: 'James Wilson',
          senderAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
          text: "Looking forward to starting the new program!",
          timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          isRead: true
        }
      ]
    },
    {
      id: 'conv-5',
      name: 'Lisa Park',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
      lastMessage: "Can we reschedule our Wednesday session?",
      lastMessageTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      unreadCount: 0,
      isOnline: false,
      messages: [
        {
          id: 'msg-5-1',
          senderId: 'lisa',
          senderName: 'Lisa Park',
          senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
          text: "Can we reschedule our Wednesday session?",
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          isRead: true
        }
      ]
    }
  ];
};

function formatMessageTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DemoChatComponents() {
  const [conversations] = useState<DemoConversation[]>(generateDemoConversations());
  const [selectedConversation, setSelectedConversation] = useState<DemoConversation | null>(conversations[0]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    // Show signup modal instead of actually sending
    setShowSignupModal(true);
    setMessageInput('');
  };

  const filteredConversations = conversations.filter(conv => 
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="fixed top-0 left-0 right-0 lg:left-[72px] flex flex-col bg-[#faf8f6] dark:bg-[#05070b] pb-[85px] lg:pb-0"
      style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
    >
      {/* Demo Mode Banner */}
      <div className="bg-brand-accent/10 dark:bg-brand-accent/5 border-b border-brand-accent/30 dark:border-brand-accent/20 px-4 py-2">
        <p className="text-sm text-center text-brand-accent-dark dark:text-brand-accent">
          <span className="font-medium">Demo Mode:</span> Explore the chat interface. Sending messages is disabled in demo mode.
        </p>
      </div>

      <div className="flex h-full overflow-hidden">
        {/* Conversation List */}
        <div className={`${showMobileList ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 xl:w-80 border-r border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0 flex-col`}>
          {/* Header */}
          <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">Messages</h2>
          </div>

          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#f3f1ef] dark:bg-[#11141b] border-0 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedConversation(conv);
                  setShowMobileList(false);
                }}
                className={`w-full px-3 py-3 mb-1 rounded-xl transition-colors text-left ${
                  selectedConversation?.id === conv.id
                    ? 'bg-brand-accent/10 dark:bg-brand-accent/15'
                    : 'hover:bg-[#f3f1ef] dark:hover:bg-[#11141b]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with online indicator */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={conv.avatar}
                      alt={conv.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {conv.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#faf8f6] dark:border-[#05070b]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {conv.name}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatMessageTime(conv.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500 truncate flex-1">
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 bg-brand-accent rounded-full text-white text-xs font-medium flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConversation ? (
          <div className={`${!showMobileList ? 'flex' : 'hidden'} lg:flex flex-1 flex-col`}>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#05070b]">
              <div className="flex items-center gap-3">
                {/* Back button for mobile */}
                <button
                  onClick={() => setShowMobileList(true)}
                  className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b]"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="relative">
                  <img
                    src={selectedConversation.avatar}
                    alt={selectedConversation.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  {selectedConversation.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#faf8f6] dark:border-[#05070b]" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {selectedConversation.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedConversation.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowSignupModal(true)}
                  className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] text-gray-600 dark:text-gray-400"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowSignupModal(true)}
                  className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] text-gray-600 dark:text-gray-400"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] text-gray-600 dark:text-gray-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.messages.map((msg) => {
                const isOwn = msg.senderId === DEMO_USER.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl ${
                          isOwn
                            ? 'bg-brand-accent text-white rounded-br-md'
                            : 'bg-[#f3f1ef] dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.text}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        <span className="text-xs text-gray-400">
                          {formatFullTime(msg.timestamp)}
                        </span>
                        {isOwn && (
                          msg.isRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-gray-400" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#05070b]">
              <div className="flex items-end gap-3">
                <button 
                  onClick={() => setShowSignupModal(true)}
                  className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] text-gray-500"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message... (disabled in demo)"
                    rows={1}
                    className="w-full px-4 py-3 rounded-2xl bg-[#f3f1ef] dark:bg-[#11141b] border-0 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 resize-none"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                </div>
                <button 
                  onClick={() => setShowSignupModal(true)}
                  className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] text-gray-500"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  className="p-3 rounded-xl bg-brand-accent hover:bg-brand-accent-dark text-white transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
            <div className="text-center px-4 max-w-md">
              <div className="mx-auto w-16 h-16 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-brand-accent" />
              </div>
              <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Select a conversation
              </h3>
              <p className="text-sm text-gray-500">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Signup Modal */}
      <DemoSignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        action="send messages"
      />
    </div>
  );
}

