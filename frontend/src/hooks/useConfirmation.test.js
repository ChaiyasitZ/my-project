/**
 * useConfirmation Hook Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConfirmation } from './useConfirmation';

describe('useConfirmation', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useConfirmation());
      
      expect(result.current.confirmationState.isOpen).toBe(false);
      expect(result.current.confirmationState.title).toBe('');
      expect(result.current.confirmationState.message).toBe('');
      expect(result.current.confirmationState.confirmText).toBe('Confirm');
      expect(result.current.confirmationState.cancelText).toBe('Cancel');
      expect(result.current.confirmationState.type).toBe('warning');
      expect(result.current.confirmationState.loading).toBe(false);
    });

    it('should return required functions', () => {
      const { result } = renderHook(() => useConfirmation());
      
      expect(typeof result.current.showConfirmation).toBe('function');
      expect(typeof result.current.closeConfirmation).toBe('function');
      expect(typeof result.current.setLoading).toBe('function');
    });
  });

  describe('showConfirmation', () => {
    it('should open confirmation with provided options', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({
          title: 'Test Title',
          message: 'Test Message'
        });
      });
      
      expect(result.current.confirmationState.isOpen).toBe(true);
      expect(result.current.confirmationState.title).toBe('Test Title');
      expect(result.current.confirmationState.message).toBe('Test Message');
    });

    it('should use default values when options not provided', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({});
      });
      
      expect(result.current.confirmationState.title).toBe('Confirm Action');
      expect(result.current.confirmationState.message).toBe('Are you sure you want to proceed?');
      expect(result.current.confirmationState.confirmText).toBe('Confirm');
      expect(result.current.confirmationState.cancelText).toBe('Cancel');
    });

    it('should use custom button text', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({
          title: 'Delete',
          message: 'Delete item?',
          confirmText: 'Yes, Delete',
          cancelText: 'No, Keep'
        });
      });
      
      expect(result.current.confirmationState.confirmText).toBe('Yes, Delete');
      expect(result.current.confirmationState.cancelText).toBe('No, Keep');
    });

    it('should support different types', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      const types = ['warning', 'danger', 'info', 'success'];
      
      for (const type of types) {
        act(() => {
          result.current.showConfirmation({
            title: 'Test',
            message: 'Test',
            type
          });
        });
        
        expect(result.current.confirmationState.type).toBe(type);
        
        act(() => {
          result.current.closeConfirmation();
        });
      }
    });

    it('should resolve true when confirmed', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      let confirmPromise;
      
      act(() => {
        confirmPromise = result.current.showConfirmation({
          title: 'Test',
          message: 'Test'
        });
      });
      
      // Wait for state to update
      await waitFor(() => {
        expect(result.current.confirmationState.onConfirm).toBeDefined();
      });
      
      let confirmResult;
      await act(async () => {
        // Simulate confirm
        result.current.confirmationState.onConfirm();
        confirmResult = await confirmPromise;
      });
      
      expect(confirmResult).toBe(true);
      expect(result.current.confirmationState.isOpen).toBe(false);
    });

    it('should resolve false when cancelled', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      let confirmPromise;
      
      act(() => {
        confirmPromise = result.current.showConfirmation({
          title: 'Test',
          message: 'Test'
        });
      });
      
      // Wait for state to update
      await waitFor(() => {
        expect(result.current.confirmationState.onCancel).toBeDefined();
      });
      
      let confirmResult;
      await act(async () => {
        // Simulate cancel
        result.current.confirmationState.onCancel();
        confirmResult = await confirmPromise;
      });
      
      expect(confirmResult).toBe(false);
      expect(result.current.confirmationState.isOpen).toBe(false);
    });
  });

  describe('closeConfirmation', () => {
    it('should close the confirmation', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({
          title: 'Test',
          message: 'Test'
        });
      });
      
      expect(result.current.confirmationState.isOpen).toBe(true);
      
      act(() => {
        result.current.closeConfirmation();
      });
      
      expect(result.current.confirmationState.isOpen).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set loading state', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({
          title: 'Test',
          message: 'Test'
        });
      });
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.confirmationState.loading).toBe(true);
    });

    it('should set custom loading text', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({
          title: 'Test',
          message: 'Test'
        });
      });
      
      act(() => {
        result.current.setLoading(true, 'Deleting...');
      });
      
      expect(result.current.confirmationState.loading).toBe(true);
      expect(result.current.confirmationState.loadingText).toBe('Deleting...');
    });

    it('should preserve existing loading text if not provided', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({
          title: 'Test',
          message: 'Test',
          loadingText: 'Custom Loading...'
        });
      });
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.confirmationState.loadingText).toBe('Custom Loading...');
    });

    it('should unset loading state', async () => {
      const { result } = renderHook(() => useConfirmation());
      
      act(() => {
        result.current.showConfirmation({
          title: 'Test',
          message: 'Test'
        });
        result.current.setLoading(true);
      });
      
      expect(result.current.confirmationState.loading).toBe(true);
      
      act(() => {
        result.current.setLoading(false);
      });
      
      expect(result.current.confirmationState.loading).toBe(false);
    });
  });
});
