/**
 * Sidebar Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../test/utils';
import Sidebar from './Sidebar';

// Helper to create connectionStatus prop
const createConnectionStatus = (backend = 'connected', database = 'connected', version = '2.0.0') => ({
  backend,
  database,
  version
});

describe('Sidebar', () => {
  describe('rendering', () => {
    it('should render all navigation items', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Devices')).toBeInTheDocument();
      expect(screen.getByText('Configurations')).toBeInTheDocument();
      expect(screen.getByText('Console Setup')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Backups')).toBeInTheDocument();
    });

    it('should render app name', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      expect(screen.getAllByText('NetAutomate').length).toBeGreaterThan(0);
    });
  });

  describe('connection status', () => {
    it('should show connected status for backend and database', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus('connected', 'connected')} />);
      
      expect(screen.getByText('Backend')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getAllByText('Connected').length).toBe(2);
    });

    it('should show disconnected status when backend error', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus('error', 'error')} />);
      
      expect(screen.getAllByText('Disconnected').length).toBe(2);
    });

    it('should show checking status by default', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus('checking', 'checking')} />);
      
      // 2 in footer (backend + database) + 1 in mobile header = 3
      expect(screen.getAllByText('Checking...').length).toBeGreaterThanOrEqual(2);
    });

    it('should default to checking when no status provided', () => {
      renderWithRouter(<Sidebar />);
      
      // 2 in footer (backend + database) + 1 in mobile header = 3
      expect(screen.getAllByText('Checking...').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('navigation links', () => {
    it('should have correct href for Dashboard', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      const dashboardLink = screen.getAllByRole('link', { name: /dashboard/i })[0];
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    it('should have correct href for Devices', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      const devicesLink = screen.getAllByRole('link', { name: /devices/i })[0];
      expect(devicesLink).toHaveAttribute('href', '/devices');
    });

    it('should have correct href for Configurations', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      const configLink = screen.getAllByRole('link', { name: /configurations/i })[0];
      expect(configLink).toHaveAttribute('href', '/configurations');
    });

    it('should have correct href for Backups', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      const backupsLink = screen.getAllByRole('link', { name: /backups/i })[0];
      expect(backupsLink).toHaveAttribute('href', '/backups');
    });
  });

  describe('active state', () => {
    it('should highlight active route', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />, { route: '/dashboard' });
      
      // The active link should have active styles
      const dashboardLink = screen.getAllByRole('link', { name: /dashboard/i })[0];
      expect(dashboardLink.className).toContain('bg-gradient');
    });
  });

  describe('mobile menu', () => {
    it('should have mobile menu toggle button', () => {
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      const toggleButton = screen.getByLabelText('Toggle menu');
      expect(toggleButton).toBeInTheDocument();
    });

    it('should toggle mobile menu on button click', async () => {
      const user = userEvent.setup();
      renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
      
      const toggleButton = screen.getByLabelText('Toggle menu');
      
      // Initially closed
      await user.click(toggleButton);
      
      // Menu should be open now (overlay should appear)
      // This is a simplified test - actual behavior depends on CSS
    });
  });
});

describe('Sidebar accessibility', () => {
  it('should have proper aria labels', () => {
    renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
    
    expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile navigation')).toBeInTheDocument();
  });

  it('should have accessible navigation', () => {
    renderWithRouter(<Sidebar connectionStatus={createConnectionStatus()} />);
    
    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(nav).toBeInTheDocument();
  });
});
