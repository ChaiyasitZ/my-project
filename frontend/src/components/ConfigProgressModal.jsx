import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  XIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  Loader2,
  CodeIcon,
  CpuIcon,
  FileTextIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  SparklesIcon
} from 'lucide-react';

const STEPS = [
  { id: 'analyzing', label: 'Analyzing Request', icon: FileTextIcon, description: 'Parsing your configuration prompt...' },
  { id: 'loading-models', label: 'Loading Models', icon: CpuIcon, description: 'Preparing AI model and context...' },
  { id: 'generating', label: 'Generating Configuration', icon: SparklesIcon, description: 'AI is crafting your configuration...' },
  { id: 'validating', label: 'Validating Syntax', icon: ShieldCheckIcon, description: 'Checking configuration syntax...' },
  { id: 'complete', label: 'Complete', icon: CheckCircleIcon, description: 'Configuration ready!' }
];

function ConfigProgressModal({ 
  isOpen, 
  onClose, 
  isGenerating,
  configMode = 'cli',
  error = null,
  generatedConfig = null
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState({});

  // Simulate progress through steps while generating
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setStepStatuses({});
      return;
    }

    if (isGenerating) {
      // Reset on start
      setCurrentStep(0);
      setStepStatuses({ analyzing: 'in-progress' });

      // Progress through steps with realistic timing
      const timings = [800, 1200, 2500, 1000]; // ms for each step
      let stepIndex = 0;

      const progressStep = () => {
        if (stepIndex < STEPS.length - 1) {
          const currentStepId = STEPS[stepIndex].id;
          const nextStepId = STEPS[stepIndex + 1].id;

          setStepStatuses(prev => ({
            ...prev,
            [currentStepId]: 'complete',
            [nextStepId]: 'in-progress'
          }));
          setCurrentStep(stepIndex + 1);
          stepIndex++;

          if (stepIndex < STEPS.length - 1) {
            setTimeout(progressStep, timings[stepIndex] || 1000);
          }
        }
      };

      const timer = setTimeout(progressStep, timings[0]);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isGenerating]);

  // Handle completion or error
  useEffect(() => {
    if (!isGenerating && isOpen) {
      if (error) {
        // Mark current step as failed
        setStepStatuses(prev => {
          const newStatuses = { ...prev };
          STEPS.forEach((step, idx) => {
            if (idx < currentStep) {
              newStatuses[step.id] = 'complete';
            } else if (idx === currentStep) {
              newStatuses[step.id] = 'failed';
            }
          });
          return newStatuses;
        });
      } else if (generatedConfig) {
        // Mark all steps as complete
        setStepStatuses(
          STEPS.reduce((acc, step) => ({ ...acc, [step.id]: 'complete' }), {})
        );
        setCurrentStep(STEPS.length - 1);
      }
    }
  }, [isGenerating, error, generatedConfig, isOpen, currentStep]);

  const getStepIcon = (step, status) => {
    const IconComponent = step.icon;
    
    switch (status) {
      case 'in-progress':
        return <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />;
      case 'complete':
        return <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <IconComponent className="h-5 w-5 text-gray-400 dark:text-gray-500" />;
    }
  };

  const getStepClasses = (status) => {
    switch (status) {
      case 'in-progress':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700';
      case 'complete':
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700';
      case 'failed':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  if (!isOpen) return null;

  const modeLabel = configMode === 'netconf' ? 'NETCONF/YANG' : 'CLI';
  const isComplete = !isGenerating && generatedConfig && !error;
  const hasFailed = !isGenerating && error;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={isComplete || hasFailed ? onClose : undefined}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-xl transform transition-all max-w-lg w-full pointer-events-auto animate-fade-in">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  hasFailed 
                    ? 'bg-red-100 dark:bg-red-900/50' 
                    : isComplete 
                      ? 'bg-green-100 dark:bg-green-900/50'
                      : 'bg-blue-100 dark:bg-blue-900/50'
                }`}>
                  {hasFailed ? (
                    <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  ) : isComplete ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <CodeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {hasFailed 
                      ? 'Generation Failed' 
                      : isComplete 
                        ? 'Configuration Ready!'
                        : `Generating ${modeLabel} Configuration`
                    }
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {hasFailed 
                      ? 'An error occurred during generation'
                      : isComplete
                        ? 'Your configuration has been generated successfully'
                        : 'Please wait while AI generates your configuration...'
                    }
                  </p>
                </div>
              </div>
              {(isComplete || hasFailed) && (
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close modal"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-5">
            <div className="space-y-3">
              {STEPS.map((step, index) => {
                const status = stepStatuses[step.id] || 'pending';
                const isActive = status === 'in-progress';
                
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 ${getStepClasses(status)}`}
                  >
                    <div className="flex-shrink-0">
                      {getStepIcon(step, status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        status === 'in-progress' 
                          ? 'text-blue-900 dark:text-blue-100' 
                          : status === 'complete'
                            ? 'text-green-900 dark:text-green-100'
                            : status === 'failed'
                              ? 'text-red-900 dark:text-red-100'
                              : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 animate-pulse">
                          {step.description}
                        </p>
                      )}
                    </div>
                    {status === 'in-progress' && (
                      <div className="flex-shrink-0">
                        <div className="h-1.5 w-16 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 dark:bg-blue-400 rounded-full animate-progress" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error Message */}
            {hasFailed && error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
                <div className="flex gap-3">
                  <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">Error Details</p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Summary */}
            {isComplete && generatedConfig && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
                <div className="flex gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">Generation Complete</p>
                    <div className="text-sm text-green-700 dark:text-green-300 mt-1 space-y-1">
                      <p>• Configuration type: {generatedConfig.config_type || modeLabel}</p>
                      {generatedConfig.validation?.valid !== undefined && (
                        <p>• Syntax valid: {generatedConfig.validation.valid ? 'Yes ✓' : 'No ✗'}</p>
                      )}
                      {generatedConfig.generated_config && (
                        <p>• Lines of config: {generatedConfig.generated_config.split('\n').length}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            {(isComplete || hasFailed) ? (
              <button
                onClick={onClose}
                className="btn btn-primary btn-md"
              >
                {isComplete ? 'View Configuration' : 'Close'}
              </button>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating... Please don&apos;t close this window
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfigProgressModal;
