import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export interface TourStep {
  targetId?: string; // If undefined, modal is centered
  title: string;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface UIWalkthroughProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
}

const UIWalkthrough: React.FC<UIWalkthroughProps> = ({ steps, isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  // Used to force re-render on resize for centered modal calculation
  const [, setTick] = useState(0);

  // Reset step when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Update rect when step changes or window resizes
  const updateRect = useCallback(() => {
    setTick(t => t + 1);
    const step = steps[currentStep];
    if (step.targetId) {
      const el = document.getElementById(step.targetId);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null); // Fallback to center if element not found
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep, steps]);

  useEffect(() => {
    if (!isOpen) return;
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [isOpen, currentStep, updateRect]);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Calculate Tooltip Position
  const getTooltipStyle = () => {
    const TOOLTIP_WIDTH = 300;
    const windowWidth = window.innerWidth;

    if (!targetRect) {
      // Centered calculation in pixels to avoid transform-origin issues during transition
      const left = Math.max(10, (windowWidth - TOOLTIP_WIDTH) / 2);
      
      return {
        top: '50%',
        left: `${left}px`,
        transform: 'translateY(-50%)',
        maxWidth: '90vw',
        width: `${TOOLTIP_WIDTH}px`
      };
    }

    const gap = 12;
    
    // Default to bottom if not specified
    let top = targetRect.bottom + gap;
    let left = targetRect.left + (targetRect.width / 2) - (TOOLTIP_WIDTH / 2);

    if (step.position === 'top') {
      top = targetRect.top - gap; 
      // We'll handle the translateY(-100%) in the return object
    } else if (step.position === 'left') {
      top = targetRect.top;
      left = targetRect.left - TOOLTIP_WIDTH - gap;
    } else if (step.position === 'right') {
      top = targetRect.top;
      left = targetRect.right + gap;
    }

    // Keep within viewport (simple clamp)
    if (left < 10) left = 10;
    if (left + TOOLTIP_WIDTH > windowWidth - 10) left = windowWidth - TOOLTIP_WIDTH - 10;

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform: step.position === 'top' ? 'translateY(-100%)' : 'none',
      width: `${TOOLTIP_WIDTH}px`,
      maxWidth: '90vw'
    };
  };

  const tooltipStyle = getTooltipStyle();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden touch-none">
      
      {/* Spotlight Shadow Layer */}
      {targetRect ? (
        <div 
          className="absolute transition-all duration-300 ease-in-out border-slate-900/80 rounded-lg"
          style={{
             // The box-shadow trick: a huge shadow creates the dimming overlay
             boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.85)', 
             top: targetRect.top - 4,
             left: targetRect.left - 4,
             width: targetRect.width + 8,
             height: targetRect.height + 8,
          }}
        />
      ) : (
        // Full overlay if no target
        <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm" />
      )}

      {/* Tooltip Card */}
      <div 
        className="absolute bg-white text-slate-900 p-5 rounded-xl shadow-2xl transition-all duration-300 z-50 flex flex-col gap-3 border-2 border-blue-500 animate-fade-in"
        style={tooltipStyle}
      >
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg leading-tight">{step.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        
        <div className="text-sm text-slate-600 leading-relaxed">
          {step.content}
        </div>

        <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-400 font-medium">
             {currentStep + 1} / {steps.length}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button 
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 transition"
              >
                Back
              </button>
            )}
            <button 
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition flex items-center gap-1 shadow-lg shadow-blue-500/30"
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
        
        {/* Arrow pointer if target exists (Simplified) */}
        {targetRect && (
             <div 
               className={`absolute w-3 h-3 bg-white border-blue-500 transform rotate-45 
                 ${step.position === 'top' ? 'bottom-[-7px] border-b-2 border-r-2 border-t-0 border-l-0 bg-white' : ''}
                 ${(!step.position || step.position === 'bottom') ? 'top-[-7px] border-t-2 border-l-2 border-b-0 border-r-0 bg-white' : ''}
               `}
               style={{ 
                  left: '50%', 
                  marginLeft: '-6px',
                  // Only show for top/bottom simple positioning for now
                  display: (step.position === 'left' || step.position === 'right') ? 'none' : 'block'
               }}
             />
        )}
      </div>

    </div>
  );
};

export default UIWalkthrough;