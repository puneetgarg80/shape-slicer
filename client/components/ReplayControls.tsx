import React from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, X, Upload } from 'lucide-react';

interface ReplayControlsProps {
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onExit: () => void;
    isPlaying: boolean;
    currentStep: number;
    totalSteps: number;
}

const ReplayControls: React.FC<ReplayControlsProps> = ({
    onPlayPause,
    onNext,
    onPrev,
    onExit,
    isPlaying,
    currentStep,
    totalSteps,
}) => {
    return (
        <div className="absolute inset-x-0 bottom-6 z-50 flex justify-center">
            <div className="bg-slate-800/95 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-blue-500/50 flex flex-col gap-2 min-w-[300px]">
                {/* Progress Bar */}
                <div className="px-2 pt-1 flex justify-between text-xs text-blue-300 font-mono">
                    <span>STEP {currentStep}</span>
                    <span>{totalSteps}</span>
                </div>
                <div className="mx-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(100, (currentStep / totalSteps) * 100)}%` }}
                    />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between gap-4 mt-1">
                    <button onClick={onExit} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition" title="Exit Replay">
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onPrev}
                            disabled={currentStep <= 0}
                            className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl transition active:scale-95"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <button
                            onClick={onPlayPause}
                            className={`p-4 rounded-xl text-white shadow-lg transition transform active:scale-95 ${isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-green-600 hover:bg-green-500'}`}
                        >
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                        </button>

                        <button
                            onClick={onNext}
                            disabled={currentStep >= totalSteps}
                            className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl transition active:scale-95"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Spacer to center main controls */}
                    <div className="w-10"></div>
                </div>
            </div>
        </div>
    );
};

export default ReplayControls;
