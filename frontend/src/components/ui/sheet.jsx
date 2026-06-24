import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

const SheetContent = React.forwardRef(({ className, children, side = 'right', ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex flex-col bg-white shadow-xl transition ease-in-out',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:duration-300 data-[state=open]:duration-500',
        side === 'right' &&
          'inset-y-0 right-0 h-full w-full sm:w-3/4 sm:max-w-lg data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        {children}
        <DialogPrimitive.Close className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 ml-4">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

const SheetBody = ({ className, ...props }) => (
  <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props} />
);

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1', className)} {...props} />
);

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-gray-900', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-gray-500', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetBody,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
