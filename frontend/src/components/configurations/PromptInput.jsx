/**
 * PromptInput Component
 * Text area with translation support for configuration prompts
 */
import React, { memo } from 'react';
import { Send as SendIcon } from 'lucide-react';

/**
 * Translation Icon SVG
 */
const TranslateIcon = () => (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" 
    />
  </svg>
);

/**
 * Prompt Input with Translation
 * @param {Object} props - Component props
 * @param {string} props.prompt - Current prompt value
 * @param {string} props.promptLanguage - Detected language ('en' or 'th')
 * @param {boolean} props.isTranslating - Whether translation is in progress
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {string} props.selectedDevice - Selected device ID
 * @param {Function} props.onPromptChange - Handler for prompt change
 * @param {Function} props.onTranslate - Handler for translation
 * @param {Function} props.onSubmit - Handler for form submission
 */
const PromptInput = memo(({
  prompt,
  promptLanguage,
  isTranslating,
  isGenerating,
  selectedDevice,
  onPromptChange,
  onTranslate,
  onSubmit
}) => {
  /**
   * Get placeholder text based on language
   */
  const placeholder = promptLanguage === 'th' 
    ? "ใส่คำสั่งเครือข่าย เช่น 'ตั้งค่า interface fe0/1 ด้วย IP 192.168.1.1/24'"
    : "Enter Cisco commands. Example: 'interface fe0/1 ip 192.168.1.1/24'";

  /**
   * Check if form is valid for submission
   */
  const isSubmitDisabled = isGenerating || !selectedDevice || !prompt || prompt.length < 10;

  return (
    <>
      {/* Prompt Label with Translate Button */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Configuration Prompt
          </label>
          
          {/* Translate Button */}
          <button
            type="button"
            onClick={onTranslate}
            disabled={!prompt.trim() || isTranslating}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              !prompt.trim() || isTranslating
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-sm hover:shadow'
            }`}
            title={promptLanguage === 'en' ? 'Translate to Thai' : 'Translate to English'}
          >
            {isTranslating ? (
              <>
                <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                Translating...
              </>
            ) : (
              <>
                <TranslateIcon />
                {promptLanguage === 'en' ? '🇺🇸 → 🇹🇭' : '🇹🇭 → 🇺🇸'}
              </>
            )}
          </button>
        </div>
        
        {/* Text Area */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={placeholder}
            className="input pr-12"
            rows="3"
            required
            minLength="10"
          />
          
          {/* Language Indicator */}
          {prompt && (
            <span className="absolute bottom-2 right-2 text-xs text-gray-400">
              {promptLanguage === 'en' ? '🇺🇸' : '🇹🇭'}
            </span>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitDisabled}
        onClick={onSubmit}
        className="btn btn-primary btn-md w-full"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Generating...
          </>
        ) : (
          <>
            <SendIcon className="h-4 w-4 mr-2" />
            Generate Configuration
          </>
        )}
      </button>
    </>
  );
});

PromptInput.displayName = 'PromptInput';

export default PromptInput;
