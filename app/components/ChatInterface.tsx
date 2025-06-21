import { useState, useRef, useEffect } from 'react';
import { Form, useNavigation, useActionData } from '@remix-run/react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  liked?: boolean;
  disliked?: boolean;
  file?: {
    name: string;
    size: number;
    type: string;
  };
}

interface ChatInterfaceProps {
  initialMessages?: Message[];
}

export default function ChatInterface({ initialMessages = [] }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const navigation = useNavigation();
  const actionData = useActionData<any>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = navigation.state === 'submitting';

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle action data from server
  useEffect(() => {
    if (actionData?.analysis && actionData?.symbol) {
      const newMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: actionData.analysis,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    }
  }, [actionData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      
      // Check file type (allow common formats)
      const allowedTypes = [
        'text/plain',
        'text/csv',
        'application/json',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        alert('File type not supported. Please upload text, CSV, JSON, PDF, or image files.');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (inputValue.trim() || selectedFile) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: inputValue || `Uploaded file: ${selectedFile?.name}`,
        timestamp: new Date(),
        file: selectedFile ? {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type
        } : undefined
      };
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
      console.log('Message copied to clipboard');
    } catch (err) {
      console.error('Failed to copy message:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const handleLike = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, liked: !msg.liked, disliked: false }
        : msg
    ));
    console.log('Message liked:', messageId);
  };

  const handleDislike = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, disliked: !msg.disliked, liked: false }
        : msg
    ));
    console.log('Message disliked:', messageId);
  };

  const handleRetry = (messageId: string) => {
    // Find the message to retry
    const messageToRetry = messages.find(msg => msg.id === messageId);
    if (!messageToRetry) return;

    // Find the user message that prompted this AI response
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    let userMessage = null;
    
    // Look backwards for the most recent user message
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].type === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (userMessage) {
      // Remove all messages after and including the AI message being retried
      setMessages(prev => prev.slice(0, messageIndex));
      
      // Set the input to the original user message content
      setInputValue(userMessage.content);
      
      // Focus the input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
    
    console.log('Retrying message:', messageId);
  };

  const formatMessage = (content: string) => {
    // Enhanced formatting for AI responses with better line breaks and styling
    return content.split('\n').map((line, index) => {
      if (line.trim() === '') return <br key={index} />;
      
      // Handle bullet points and special formatting
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return (
          <div key={index} className="flex items-start gap-2 mb-2">
            <span className="text-orange-400 mt-1">•</span>
            <span className="flex-1">{line.substring(2)}</span>
          </div>
        );
      }
      
      // Handle headers (lines with emojis or all caps)
      if (line.match(/^[🔥📊💡⚡🎯🚀]+/) || line.match(/^[A-Z\s]{3,}:/)) {
        return (
          <div key={index} className="font-semibold text-white mb-3 mt-4 first:mt-0">
            {line}
          </div>
        );
      }
      
      return (
        <p key={index} className="mb-2 leading-relaxed">
          {line}
        </p>
      );
    });
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {!hasMessages && !isLoading && (
        <div className="flex items-center justify-center -mb-48">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white text-lg">✨</span>
            </div>
          
            <h1 className="text-4xl font-normal text-gray-300">
              Welcome To Crypto AI!
            </h1>
        </div>
      )}

      <div className="min-h-[200px] mb-8">
        <div className="space-y-8">
          {messages.map((message, index) => (
            <div key={message.id} className="w-full">
              {message.type === 'user' ? (
                <div className="flex justify-end mb-6">
                  <div className="flex items-start gap-3 max-w-3xl">
                    <div className="flex-1 text-right">
                      <div className="inline-block bg-gray-700/50 rounded-2xl px-4 py-3 text-white">
                        {message.content}
                        {message.file && (
                          <div className="mt-2 p-2 bg-gray-600/50 rounded-lg border border-gray-600">
                            <div className="flex items-center gap-2 text-sm">
                              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-gray-300">{message.file.name}</span>
                              <span className="text-gray-400">({formatFileSize(message.file.size)})</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      M
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 mb-8">
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-lg">✨</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose prose-invert max-w-none text-gray-300">
                      {formatMessage(message.content)}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-700/30">
                      <button 
                        className="p-2 hover:bg-orange-500/20 hover:text-orange-400 rounded-lg transition-all duration-200 group" 
                        title="Copy"
                        onClick={() => handleCopy(message.content)}
                      >
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-orange-400 transform group-hover:scale-110 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      
                      <button 
                        className={`p-2 rounded-lg transition-all duration-200 group ${
                          message.liked 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'hover:bg-green-500/20 hover:text-green-400'
                        }`}
                        title="Good response"
                        onClick={() => handleLike(message.id)}
                      >
                        <svg className={`w-4 h-4 transform group-hover:scale-110 transition-all duration-200 ${
                          message.liked ? 'text-green-400 fill-current' : 'text-gray-400 group-hover:text-green-400'
                        }`} fill={message.liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                      </button>
                      
                      <button 
                        className={`p-2 rounded-lg transition-all duration-200 group ${
                          message.disliked 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'hover:bg-red-500/20 hover:text-red-400'
                        }`}
                        title="Bad response"
                        onClick={() => handleDislike(message.id)}
                      >
                        <svg className={`w-4 h-4 transform group-hover:scale-110 transition-all duration-200 ${
                          message.disliked ? 'text-red-400 fill-current' : 'text-gray-400 group-hover:text-red-400'
                        }`} fill={message.disliked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                      </button>
                      
                      <button 
                        className="flex items-center gap-1 p-2 hover:bg-purple-500/20 hover:text-purple-400 rounded-lg transition-all duration-200 group" 
                        title="Retry"
                        onClick={() => handleRetry(message.id)}
                      >
                        <span className="text-sm text-gray-400 group-hover:text-purple-400 transition-colors duration-200">Retry</span>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-purple-400 transform group-hover:rotate-180 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-4 mb-8">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-gray-400">
                  <span>Analyzing cryptocurrency data</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-4 pt-6">
        <Form method="post" onSubmit={handleSubmit} className="relative">
          {/* File preview */}
          {selectedFile && (
            <div className="mb-3 p-3 bg-gray-800/80 rounded-xl border border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedFile}
                  className="p-1 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
                  title="Remove file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="relative bg-gray-800/60 rounded-2xl border border-gray-700/50 overflow-hidden backdrop-blur-sm">
            <div className="flex items-end">
              <div className="flex-1 min-h-[60px] flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  name="message"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={hasMessages ? "Reply..." : "How can I help you today?"}
                  className="w-full px-6 py-4 bg-transparent text-white placeholder-gray-400 border-none outline-none resize-none text-base"
                  disabled={isLoading}
                  autoComplete="off"
                />
              </div>
              
              <div className="flex items-center gap-2 p-3">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".txt,.csv,.json,.pdf,.jpg,.jpeg,.png,.gif,.xlsx,.xls"
                />
                
                {/* File upload button */}
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  className="p-2 hover:bg-orange-500/20 hover:text-orange-400 rounded-lg transition-all duration-200 text-gray-400 group"
                  title="Attach file"
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 transform group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                
                {/* Submit button with enhanced animations */}
                <button
                  type="submit"
                  disabled={isLoading || (!inputValue.trim() && !selectedFile)}
                  className="p-2.5 bg-gray-600 hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 disabled:bg-gray-700 disabled:opacity-50 rounded-xl transition-all duration-300 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-orange-500/25 group"
                  title="Send message"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}