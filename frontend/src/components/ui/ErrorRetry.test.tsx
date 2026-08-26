/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorRetry from './ErrorRetry';
import React from 'react';

describe('ErrorRetry Component', () => {
  it('renders default error state', () => {
    const handleRetry = jest.fn();
    render(<ErrorRetry onRetry={handleRetry} />);
    
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
  });

  it('detects and renders network error', () => {
    const handleRetry = jest.fn();
    const networkError = new Error('Failed to fetch');
    render(<ErrorRetry error={networkError} onRetry={handleRetry} />);
    
    expect(screen.getByText('Network connection failed. Please check your internet and try again.')).toBeInTheDocument();
    expect(screen.getByTestId('icon-network')).toBeInTheDocument();
  });

  it('detects and renders server error from status code', () => {
    const handleRetry = jest.fn();
    const serverError = { status: 500, message: 'Internal Server Error' };
    render(<ErrorRetry error={serverError} onRetry={handleRetry} />);
    
    expect(screen.getByText('We encountered a server error. Please try again later.')).toBeInTheDocument();
    expect(screen.getByTestId('icon-server')).toBeInTheDocument();
  });

  it('detects and renders server error from string', () => {
    const handleRetry = jest.fn();
    render(<ErrorRetry error="A server error occurred during request" onRetry={handleRetry} />);
    
    expect(screen.getByText('We encountered a server error. Please try again later.')).toBeInTheDocument();
    expect(screen.getByTestId('icon-server')).toBeInTheDocument();
  });

  it('displays custom error message for other errors', () => {
    const handleRetry = jest.fn();
    render(<ErrorRetry error="Custom validation failed" onRetry={handleRetry} />);
    
    expect(screen.getByText('Custom validation failed')).toBeInTheDocument();
    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const handleRetry = jest.fn();
    render(<ErrorRetry onRetry={handleRetry} />);
    
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);
    
    expect(handleRetry).toHaveBeenCalledTimes(1);
    
    // Simulate another click
    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(2);
  });
});
