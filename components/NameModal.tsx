import React, { useState } from 'react';
import { User } from 'lucide-react';

interface NameModalProps {
  onSubmit: (name: string) => void;
}

const NameModal: React.FC<NameModalProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError(true);
      return;
    }
    onSubmit(name.trim());
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-600 max-w-sm w-full animate-fade-in">
        <div className="w-16 h-16 bg-slate-700 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <User size={32} />
        </div>
        
        <h2 className="text-2xl font-bold text-white text-center mb-2">Welcome</h2>
        <p className="text-slate-400 text-center mb-6 text-sm">
          Please enter your name to start recording your puzzle solving journey.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(false);
              }}
              className={`w-full bg-slate-900 border ${error ? 'border-rose-500' : 'border-slate-600'} rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors`}
              placeholder="Your Name"
              autoFocus
            />
            {error && <p className="text-rose-500 text-xs mt-1 ml-1">Name is required</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg transition transform active:scale-95"
          >
            Start Playing
          </button>
        </form>
      </div>
    </div>
  );
};

export default NameModal;