import React from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/** Shared page wrapper: safe areas, responsive padding, no horizontal overflow */
export const PageShell: React.FC<PageShellProps> = ({ children, className }) => (
  <div className={cn('min-h-screen min-h-[100dvh] bg-gradient-to-br from-secondary-50 via-white to-primary-50 overflow-x-hidden', className)}>
    {children}
  </div>
);

export const PageMain: React.FC<PageShellProps> = ({ children, className }) => (
  <main className={cn('container mx-auto px-3 sm:px-4 py-4 sm:py-8 safe-bottom', className)}>
    {children}
  </main>
);
