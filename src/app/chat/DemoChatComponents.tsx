'use client';

import { useState } from 'react';
import { DEMO_USER } from '@/lib/demo-utils';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { MessageSquare, Send, Search, Phone, Video, MoreVertical, Smile, Paperclip, Check, CheckCheck, Megaphone, PartyPopper, Trophy, Users, Hash } from 'lucide-react';

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
  type: 'dm' | 'main';
  icon?: React.ReactNode;
}

// Generate demo main channels
const generateDemoMainChannels = (): DemoConversation[] => {
  const now = new Date();
  
  return [
    {
      id: 'announcements',
      name: 'Announcements',
      avatar: '',
      lastMessage: '🎉 Welcome to the community! Check out our new features.',
      lastMessageTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      unreadCount: 1,
      isOnline: false,
      type: 'main',
      messages: [
        {
          id: 'ann-1',
          senderId: 'coach-adam',
          senderName: 'Coach Adam',
          senderAvatar: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70',
          text: "Hey everyone! We've just launched our new weekly reflection feature. It's designed to help you track your progress and set intentions for the week ahead. Give it a try and let me know what you think!",
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'ann-2',
          senderId: 'coach-adam',
          senderName: 'Coach Adam',
          senderAvatar: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70',
          text: "🎉 Welcome to the community! Check out our new features and don't hesitate to reach out if you have any questions.",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          isRead: false
        }
      ]
    },
    {
      id: 'social-corner',
      name: 'Social Corner',
      avatar: '',
      lastMessage: 'Anyone else doing a morning routine challenge?',
      lastMessageTime: new Date(now.getTime() - 30 * 60 * 1000),
      unreadCount: 3,
      isOnline: false,
      type: 'main',
      messages: [
        {
          id: 'social-1',
          senderId: 'member-1',
          senderName: 'Jessica Martinez',
          senderAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
          text: "Good morning everyone! ☀️ What's everyone working on today?",
          timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'social-2',
          senderId: 'member-2',
          senderName: 'David Kim',
          senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
          text: "Starting a new habit tracking this week. Excited to share my progress!",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'social-3',
          senderId: 'member-3',
          senderName: 'Rachel Anderson',
          senderAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face',
          text: "Anyone else doing a morning routine challenge? I'm on day 7! 💪",
          timestamp: new Date(now.getTime() - 30 * 60 * 1000),
          isRead: false
        }
      ]
    },
    {
      id: 'share-wins',
      name: 'Share Your Wins',
      avatar: '',
      lastMessage: '🏆 Just completed my 30-day streak!',
      lastMessageTime: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      unreadCount: 0,
      isOnline: false,
      type: 'main',
      messages: [
        {
          id: 'wins-1',
          senderId: 'member-4',
          senderName: 'Alex Turner',
          senderAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face',
          text: "🏆 Just completed my 30-day streak! Never thought I'd make it this far. Thank you all for the support!",
          timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'wins-2',
          senderId: 'member-5',
          senderName: 'Sophie Chen',
          senderAvatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=face',
          text: "Amazing Alex! 🎉 That's so inspiring!",
          timestamp: new Date(now.getTime() - 3.5 * 60 * 60 * 1000),
          isRead: true
        }
      ]
    },
    {
      id: 'squad-growth',
      name: 'Growth Squad',
      avatar: '',
      lastMessage: 'See you all at the call tomorrow!',
      lastMessageTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      unreadCount: 2,
      isOnline: false,
      type: 'main',
      messages: [
        {
          id: 'squad-1',
          senderId: 'coach-adam',
          senderName: 'Coach Adam',
          senderAvatar: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70',
          text: "Hey squad! Reminder: We have our weekly check-in tomorrow at 10am. Come prepared to share one win and one challenge.",
          timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'squad-2',
          senderId: 'member-6',
          senderName: 'Marcus Johnson',
          senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
          text: "Looking forward to it! I have some exciting updates to share 📈",
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          isRead: true
        },
        {
          id: 'squad-3',
          senderId: 'member-7',
          senderName: 'Emily Brooks',
          senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
          text: "See you all at the call tomorrow! 👋",
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
          isRead: false
        }
      ]
    }
  ];
};

// Generate demo direct conversations
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
      type: 'dm',
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
      type: 'dm',
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
      type: 'dm',
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
      type: 'dm',
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
      type: 'dm',
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

// Get icon for channel type
const getChannelIcon = (conv: DemoConversation) => {
  if (conv.id === 'announcements') {
    return <Megaphone className="w-5 h-5 text-amber-500" />;
  }
  if (conv.id === 'social-corner') {
    return <PartyPopper className="w-5 h-5 text-pink-500" />;
  }
  if (conv.id === 'share-wins') {
    return <Trophy className="w-5 h-5 text-yellow-500" />;
  }
  if (conv.id.startsWith('squad-')) {
    return <Users className="w-5 h-5 text-brand-accent" />;
  }
  return null;
};

export default function DemoChatComponents() {
  const [mainChannels] = useState<DemoConversation[]>(generateDemoMainChannels());
  const [directConversations] = useState<DemoConversation[]>(generateDemoConversations());
  const [selectedConversation, setSelectedConversation] = useState<DemoConversation | null>(directConversations[0]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [activeTab, setActiveTab] = useState<'main' | 'direct'>('main');
  const { openSignupModal } = useDemoMode();

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    // Show signup modal instead of actually sending
    openSignupModal();
    setMessageInput('');
  };

  // Get conversations based on active tab
  const currentConversations = activeTab === 'main' ? mainChannels : directConversations;
  
  const filteredConversations = currentConversations.filter(conv => 
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Calculate unread counts for tabs
  const mainUnread = mainChannels.reduce((sum, c) => sum + c.unreadCount, 0);
  const directUnread = directConversations.reduce((sum, c) => sum + c.unreadCount, 0);

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

          {/* Pill Selector Tabs - matches real chat */}
          <div className="px-4 py-3">
            <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2">
              {/* Main Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('main')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] transition-all ${
                  activeTab === 'main'
                    ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                    : ''
                }`}
              >
                <svg className={`w-5 h-5 ${activeTab === 'main' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
                  activeTab === 'main' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'
                }`}>
                  Main
                </span>
                {mainUnread > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-accent dark:bg-brand-accent text-white text-[11px] font-albert font-semibold">
                    {mainUnread > 9 ? '9+' : mainUnread}
                  </span>
                )}
              </button>
              
              {/* Direct Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('direct')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] transition-all ${
                  activeTab === 'direct'
                    ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
                    : ''
                }`}
              >
                <svg className={`w-5 h-5 ${activeTab === 'direct' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className={`font-albert text-[18px] font-semibold tracking-[-1px] ${
                  activeTab === 'direct' ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#5f5a55] dark:text-[#7d8190]'
                }`}>
                  Direct
                </span>
                {directUnread > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-accent dark:bg-brand-accent text-white text-[11px] font-albert font-semibold">
                    {directUnread > 9 ? '9+' : directUnread}
                  </span>
                )}
              </button>
            </div>
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
            {filteredConversations.map((conv) => {
              const icon = getChannelIcon(conv);
              return (
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
                    {/* Avatar or Channel Icon */}
                    <div className="relative flex-shrink-0">
                      {conv.type === 'main' && icon ? (
                        <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#11141b] flex items-center justify-center">
                          {icon}
                        </div>
                      ) : (
                        <>
                          <img
                            src={conv.avatar}
                            alt={conv.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          {conv.isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#faf8f6] dark:border-[#05070b]" />
                          )}
                        </>
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
              );
            })}
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
                  {selectedConversation.type === 'main' ? (
                    <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#11141b] flex items-center justify-center">
                      {getChannelIcon(selectedConversation)}
                    </div>
                  ) : (
                    <>
                      <img
                        src={selectedConversation.avatar}
                        alt={selectedConversation.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      {selectedConversation.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#faf8f6] dark:border-[#05070b]" />
                      )}
                    </>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {selectedConversation.name}
                  </h3>
                  {selectedConversation.type === 'dm' && (
                    <p className="text-xs text-gray-500">
                      {selectedConversation.isOnline ? 'Online' : 'Offline'}
                    </p>
                  )}
                  {selectedConversation.type === 'main' && (
                    <p className="text-xs text-gray-500">
                      {selectedConversation.id === 'announcements' && 'Important updates from Coach Adam'}
                      {selectedConversation.id === 'social-corner' && 'Community hangout'}
                      {selectedConversation.id === 'share-wins' && 'Celebrate your achievements'}
                      {selectedConversation.id.startsWith('squad-') && 'Your squad channel'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedConversation.type === 'dm' && (
                  <>
                    <button 
                      onClick={() => openSignupModal()}
                      className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] text-gray-600 dark:text-gray-400"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => openSignupModal()}
                      className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] text-gray-600 dark:text-gray-400"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </>
                )}
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
                    className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
                    />
                    <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
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
                  onClick={() => openSignupModal()}
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
                  onClick={() => openSignupModal()}
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
    </div>
  );
}

