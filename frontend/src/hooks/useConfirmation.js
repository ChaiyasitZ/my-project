import { useState, useCallback } from 'react';

export function useConfirmation() {
  const [confirmationState, setConfirmationState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning',
    loading: false,
    loadingText: 'Processing...',
    onConfirm: null,
    onCancel: null
  });

  const showConfirmation = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmationState({
        isOpen: true,
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'warning',
        loading: false,
        loadingText: options.loadingText || 'Processing...',
        onConfirm: () => {
          resolve(true);
          setConfirmationState(prev => ({ ...prev, isOpen: false }));
        },
        onCancel: () => {
          resolve(false);
          setConfirmationState(prev => ({ ...prev, isOpen: false }));
        }
      });
    });
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmationState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const setLoading = useCallback((loading, loadingText) => {
    setConfirmationState(prev => ({ 
      ...prev, 
      loading, 
      loadingText: loadingText || prev.loadingText 
    }));
  }, []);

  return {
    confirmationState,
    showConfirmation,
    closeConfirmation,
    setLoading
  };
} 