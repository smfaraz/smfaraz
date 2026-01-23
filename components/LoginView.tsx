import React, { useState } from 'react';
import { LockIcon } from './Icons';

interface Props {
  onLogin: () => void;
  onCancel: () => void;
}

export const LoginView: React.FC<Props> = ({ onLogin, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin' && password === 'admin') {
      onLogin();
    } else {
      setError('Invalid credentials (try admin/admin)');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-100 p-3 rounded-full">
              <LockIcon className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-1">Admin Access</h2>
          <p className="text-center text-gray-500 text-sm mb-8">Please sign in to manage resources</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="••••••"
              />
            </div>
            
            {error && <div className="text-red-500 text-sm text-center">{error}</div>}

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Sign In
            </button>
          </form>
        </div>
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};