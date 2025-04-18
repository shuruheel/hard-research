'use client';

import { useFormStatus } from 'react-dom';

import { LoaderIcon } from '@/components/icons';

import { Button } from './ui/button';

export function SubmitButton({
  children,
  isPending,
}: {
  children: React.ReactNode;
  isPending?: boolean;
}) {
  const { pending: formStatusPending } = useFormStatus();
  const currentlyPending = isPending ?? formStatusPending;

  return (
    <Button
      type={currentlyPending ? 'button' : 'submit'}
      aria-disabled={currentlyPending}
      disabled={currentlyPending}
      className="relative"
    >
      {children}

      {currentlyPending && (
        <span className="animate-spin absolute right-4">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {currentlyPending ? 'Loading' : 'Submit form'}
      </output>
    </Button>
  );
}
