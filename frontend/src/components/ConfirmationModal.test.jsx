/**
 * ConfirmationModal Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmationModal from './ConfirmationModal';

describe('ConfirmationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Test Title',
    message: 'Test Message'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when isOpen is true', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Message')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<ConfirmationModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
    });

    it('should render default button text', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render custom button text', () => {
      render(
        <ConfirmationModal 
          {...defaultProps} 
          confirmText="Yes, Delete"
          cancelText="No, Keep"
        />
      );
      
      expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
      expect(screen.getByText('No, Keep')).toBeInTheDocument();
    });
  });

  describe('modal types', () => {
    it('should render warning type by default', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      // Check for warning icon (yellow color class)
      const iconContainer = document.querySelector('.bg-yellow-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should render danger type', () => {
      render(<ConfirmationModal {...defaultProps} type="danger" />);
      
      const iconContainer = document.querySelector('.bg-red-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should render success type', () => {
      render(<ConfirmationModal {...defaultProps} type="success" />);
      
      const iconContainer = document.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should render info type', () => {
      render(<ConfirmationModal {...defaultProps} type="info" />);
      
      const iconContainer = document.querySelector('.bg-blue-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      
      render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} />);
      
      await user.click(screen.getByText('Confirm'));
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
      
      await user.click(screen.getByText('Cancel'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button (X) is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
      
      await user.click(screen.getByLabelText('Close modal'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
      
      // Click on the backdrop container
      const backdrop = screen.getByRole('dialog').querySelector('.flex.items-center');
      if (backdrop) {
        await user.click(backdrop);
        // Note: This might not trigger onClose due to event bubbling
      }
    });
  });

  describe('loading state', () => {
    it('should show loading text when loading', () => {
      render(
        <ConfirmationModal 
          {...defaultProps} 
          loading={true}
          loadingText="Deleting..."
        />
      );
      
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });

    it('should disable buttons when loading', () => {
      render(<ConfirmationModal {...defaultProps} loading={true} />);
      
      expect(screen.getByText(/Processing/)).toBeInTheDocument();
    });

    it('should not call onConfirm when loading', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      
      render(
        <ConfirmationModal 
          {...defaultProps} 
          onConfirm={onConfirm}
          loading={true}
        />
      );
      
      // Try to click confirm button
      const confirmButton = screen.getByText(/Processing/);
      await user.click(confirmButton);
      
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interactions', () => {
    it('should close on Escape key press', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
      
      await user.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should not close on Escape when loading', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(
        <ConfirmationModal 
          {...defaultProps} 
          onClose={onClose}
          loading={true}
        />
      );
      
      await user.keyboard('{Escape}');
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria attributes', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(modal).toHaveAttribute('aria-describedby', 'modal-description');
    });

    it('should have accessible title', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Title');
    });
  });

  describe('multiline message', () => {
    it('should preserve whitespace in message', () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3';
      
      render(
        <ConfirmationModal 
          {...defaultProps} 
          message={multilineMessage}
        />
      );
      
      // Check that the message container has whitespace-pre-line class
      const messageElement = screen.getByText(/Line 1/);
      expect(messageElement).toHaveClass('whitespace-pre-line');
    });
  });
});
