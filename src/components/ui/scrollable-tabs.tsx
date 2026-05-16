import * as React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** Horizontally scrollable tab bar on small screens */
export const ScrollableTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <TabsList
    ref={ref}
    className={cn(
      'scrollbar-thin-x w-full h-auto min-h-11 flex-nowrap justify-start gap-1 p-1 overflow-x-auto',
      className
    )}
    {...props}
  />
));
ScrollableTabsList.displayName = 'ScrollableTabsList';

export const MobileTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, children, ...props }, ref) => (
  <TabsTrigger
    ref={ref}
    className={cn('shrink-0 min-h-11 px-3 sm:px-4 text-xs sm:text-sm', className)}
    {...props}
  >
    {children}
  </TabsTrigger>
));
MobileTabsTrigger.displayName = 'MobileTabsTrigger';
