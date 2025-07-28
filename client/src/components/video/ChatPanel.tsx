import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  MessageCircle, 
  User,
  Clock,
  X
} from 'lucide-react';
import type { ChatMessage } from '../../../../shared/types/video';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUser: {
    id: number;
    name: string;
    role: string;
  };
  onSendMessage: (message: string) => void;
  className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUser,
  onSendMessage,
  className = ''
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'notary': return 'bg-blue-500';
      case 'signer': return 'bg-green-500';
      case 'witness': return 'bg-purple-500';
      case 'observer': return 'bg-gray-500';
      case 'admin': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const isOwnMessage = (message: ChatMessage) => {
    return message.senderId === currentUser.id.toString();
  };

  return (
    <div className={`flex flex-col h-full bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-white" />
          <h3 className="text-white font-medium">Chat</h3>
          <Badge variant="secondary" className="bg-gray-600 text-gray-200">
            {messages.length}
          </Badge>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${isOwnMessage(message) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md ${
                  isOwnMessage(message)
                    ? 'bg-blue-600 text-white rounded-l-lg rounded-tr-lg'
                    : 'bg-gray-700 text-white rounded-r-lg rounded-tl-lg'
                } px-4 py-2`}
              >
                {/* Message Header */}
                {!isOwnMessage(message) && (
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-300" />
                    </div>
                    <span className="text-xs font-medium text-gray-300">
                      {message.senderName}
                    </span>
                  </div>
                )}

                {/* Message Content */}
                <div className="space-y-2">
                  {message.type === 'system' ? (
                    <div className="flex items-center space-x-2 text-yellow-400">
                      <Badge variant="outline" className="border-yellow-400 text-yellow-400 text-xs">
                        SYSTEM
                      </Badge>
                      <span className="text-sm italic">{message.message}</span>
                    </div>
                  ) : message.type === 'notification' ? (
                    <div className="flex items-center space-x-2 text-blue-400">
                      <Badge variant="outline" className="border-blue-400 text-blue-400 text-xs">
                        INFO
                      </Badge>
                      <span className="text-sm">{message.message}</span>
                    </div>
                  ) : (
                    <p className="text-sm break-words">{message.message}</p>
                  )}

                  {/* Timestamp */}
                  <div className={`flex items-center space-x-1 text-xs ${
                    isOwnMessage(message) ? 'text-blue-200' : 'text-gray-400'
                  }`}>
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(message.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
            maxLength={500}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        
        {/* Character count */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
          <span>
            Press Enter to send, Shift+Enter for new line
          </span>
          <span>
            {newMessage.length}/500
          </span>
        </div>
      </div>
    </div>
  );
}; 