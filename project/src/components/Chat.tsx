import React, { useState, useEffect } from 'react';
import { Send, Bot, HelpCircle, FileUp } from 'lucide-react';
import Papa from 'papaparse';
import { getGeminiResponse } from '../lib/gemini'

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface DataContext {
  columns: string[];
  summary: string;
  rowCount: number;
  sampleData: any[];
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dataContext, setDataContext] = useState<DataContext | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      await parseCSV(uploadedFile);
    }
  };

  const parseCSV = async (file: File) => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        complete: async (result) => {
          const data = result.data as any[];
          const columns = Object.keys(data[0] || {});
          
          // Create a summary of the data
          const context: DataContext = {
            columns,
            summary: generateDataSummary(data),
            rowCount: data.length,
            sampleData: data.slice(0, 5) // First 5 rows for context
          };
          
          setDataContext(context);
          
          // Add a welcome message with data summary
          const welcomeMessage: Message = {
            id: Date.now(),
            text: `I've analyzed your CSV file. It contains ${data.length} rows and ${columns.length} columns: ${columns.join(', ')}. Ask me anything about your data!`,
            sender: 'bot',
            timestamp: new Date()
          };
          
          setMessages([welcomeMessage]);
          resolve(result);
        },
        header: true,
      });
    });
  };

  const generateDataSummary = (data: any[]): string => {
    const columns = Object.keys(data[0] || {});
    let summary = `Dataset Summary:\n`;
    
    columns.forEach(column => {
      const values = data.map(row => row[column]);
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      
      if (numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const mean = sum / numericValues.length;
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        
        summary += `\n${column}:\n`;
        summary += `- Type: Numeric\n`;
        summary += `- Range: ${min} to ${max}\n`;
        summary += `- Average: ${mean.toFixed(2)}\n`;
      } else {
        const uniqueValues = new Set(values);
        summary += `\n${column}:\n`;
        summary += `- Type: Text/Categorical\n`;
        summary += `- Unique values: ${uniqueValues.size}\n`;
      }
    });
    
    return summary;
  };

  const handleSend = async () => {
    if (!input.trim() || !dataContext) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Create context string for Gemini
      const contextString = `
        File Analysis:
        ${dataContext.summary}
        
        Sample Data (first 5 rows):
        ${JSON.stringify(dataContext.sampleData, null, 2)}
      `;

      const response = await getGeminiResponse(input, contextString);

      const botMessage: Message = {
        id: Date.now() + 1,
        text: response,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: "I apologize, but I'm having trouble processing your request at the moment. Please try again later.",
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow h-[600px] flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <Bot className="h-6 w-6 text-blue-600 mr-2" />
            <h1 className="text-xl font-semibold text-gray-900">Data Analysis Assistant</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Upload a CSV file and I'll help you analyze it using AI.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                message.sender === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="whitespace-pre-wrap">{message.text}</p>
                <p className={`text-xs mt-1 ${
                  message.sender === 'user' 
                    ? 'text-blue-100' 
                    : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-4">
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200"
              >
                <FileUp className="h-5 w-5 mr-2" />
                {file ? 'Change File' : 'Upload CSV'}
              </label>
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your data..."
              className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={isLoading || !file}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !file}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          {file && (
            <p className="mt-2 text-sm text-gray-500">
              Current file: {file.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}