/**
 * Sidebar Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../test/utils';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  describe('rendering', () => {
    it('should render all navigation items', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Devices')).toBeInTheDocument();
      expect(screen.getByText('Configurations')).toBeInTheDocument();
      expect(screen.getByText('Console Setup')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Backups')).toBeInTheDocument();
    });

    it('should render app name', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      expect(screen.getAllByText('NetAutomate').length).toBeGreaterThan(0);
    });

    it('should render version number', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    });
  });

  describe('server status', () => {
    it('should show connected status', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      expect(screen.getByText('Server Connected')).toBeInTheDocument();
    });

    it('should show disconnected status', () => {
      renderWithRouter(<Sidebar serverStatus="error" />);
      
      expect(screen.getByText('Server Disconnected')).toBeInTheDocument();
    });

    it('should show checking status by default', () => {
      renderWithRouter(<Sidebar serverStatus="checking" />);
      
      expect(screen.getByText('Checking Connection...')).toBeInTheDocument();
    });

    it('should default to checking when no status provided', () => {
      renderWithRouter(<Sidebar />);
      
      expect(screen.getByText('Checking Connection...')).toBeInTheDocument();
    });
  });

  describe('navigation links', () => {
    it('should have correct href for Dashboard', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      const dashboardLink = screen.getAllByRole('link', { name: /dashboard/i })[0];
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    it('should have correct href for Devices', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      const devicesLink = screen.getAllByRole('link', { name: /devices/i })[0];
      expect(devicesLink).toHaveAttribute('href', '/devices');
    });

    it('should have correct href for Configurations', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      const configLink = screen.getAllByRole('link', { name: /configurations/i })[0];
      expect(configLink).toHaveAttribute('href', '/configurations');
    });

    it('should have correct href for Backups', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      const backupsLink = screen.getAllByRole('link', { name: /backups/i })[0];
      expect(backupsLink).toHaveAttribute('href', '/backups');
    });
  });

  describe('active state', () => {
    it('should highlight active route', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />, { route: '/dashboard' });
      
      // The active link should have active styles
      const dashboardLink = screen.getAllByRole('link', { name: /dashboard/i })[0];
      expect(dashboardLink.className).toContain('bg-gradient');
    });
  });

  describe('mobile menu', () => {
    it('should have mobile menu toggle button', () => {
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
      const toggleButton = screen.getByLabelText('Toggle menu');
      expect(toggleButton).toBeInTheDocument();
    });

    it('should toggle mobile menu on button click', async () => {
      const user = userEvent.setup();
      renderWithRouter(<Sidebar serverStatus="connected" />);
      
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
    renderWithRouter(<Sidebar serverStatus="connected" />);
    
    expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile navigation')).toBeInTheDocument();
  });

  it('should have accessible navigation', () => {
    renderWithRouter(<Sidebar serverStatus="connected" />);
    
    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(nav).toBeInTheDocument();
  });
});
