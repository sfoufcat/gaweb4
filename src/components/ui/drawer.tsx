'use client';

import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
Drawer.displayName = 'Drawer';

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay> & { zIndex?: string }
>(({ className, zIndex = 'z-[10000]', ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 bg-black/40 backdrop-blur-sm', zIndex, className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    hideHandle?: boolean;
    zIndex?: string;
  }
>(({ className, children, hideHandle, zIndex = 'z-[10000]', ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay zIndex={zIndex} />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 mt-24 flex h-auto flex-col rounded-t-[24px] border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] outline-none',
        zIndex,
        className
      )}
      {...props}
    >
      {!hideHandle && (
        <div className="pt-3 pb-2">
          <div className="mx-auto w-10 h-1 rounded-full bg-[#d1ccc6] dark:bg-[#3a4150]" />
        </div>
      )}
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('grid gap-1.5 p-4 text-center sm:text-left', className)}
    {...props}
  />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'relative flex-shrink-0 flex flex-col gap-2 px-4 pt-4 pb-7 border-t border-[#b8b3ad] dark:border-[#4a5060]',
      // Blur gradient starting from divider going up
      'before:absolute before:inset-x-0 before:bottom-full before:h-8 before:bg-gradient-to-t before:from-white before:to-transparent before:dark:from-[#171b22] before:pointer-events-none',
      className
    )}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

// Scroll area with bottom padding for blur leeway
const DrawerScrollArea = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex-1 min-h-0 overflow-y-auto pb-8', className)}
    {...props}
  />
);
DrawerScrollArea.displayName = 'DrawerScrollArea';

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-text-primary dark:text-[#f5f5f8]',
      className
    )}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn('text-sm text-text-secondary dark:text-[#b2b6c2]', className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerScrollArea,
  DrawerTitle,
  DrawerDescription,
};
