import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { BarChart2, Brain, MessageSquare, LogOut, Sun, Moon } from 'lucide-react';

export default function Navbar() {
  const { user, signOut } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className={`bg-white shadow-lg dark:bg-gray-800 ${isDarkMode ? 'dark' : ''}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex items-center px-2 py-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
              <BarChart2 className="h-6 w-6 mr-2" />
              <span className="font-semibold">FinAnalytics</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/analysis" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
              Analysis
            </Link>
            <Link to="/models" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
              <Brain className="h-5 w-5 inline mr-1" />
              Models
            </Link>
            <Link to="/chat" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
              <MessageSquare className="h-5 w-5 inline mr-1" />
              Chat
            </Link>
          
            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <LogOut className="h-5 w-5 inline mr-1" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}