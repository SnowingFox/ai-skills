'use client';

import { Button } from '@/components/ui/button';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface BaseCheckoutButtonProps {
  /** Called when the button is clicked; should return the checkout URL or null on failure */
  onCheckout: (
    metadata: Record<string, string>
  ) => Promise<{ url: string } | null>;
  /** Extra metadata supplied by the parent (e.g. referral info already collected) */
  metadata?: Record<string, string>;
  /** Toast message shown on checkout failure */
  errorMessage: string;
  /** Label shown while loading */
  loadingLabel: string;
  variant?:
    | 'default'
    | 'outline'
    | 'destructive'
    | 'secondary'
    | 'ghost'
    | 'link'
    | null;
  size?: 'default' | 'sm' | 'lg' | 'icon' | null;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Shared checkout button used by both plan checkout and credit checkout.
 *
 * Handles loading state, error toasts, and redirecting to the Stripe checkout URL.
 */
export function BaseCheckoutButton({
  onCheckout,
  metadata,
  errorMessage,
  loadingLabel,
  variant = 'default',
  size = 'default',
  className,
  children,
  disabled = false,
}: BaseCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    try {
      setIsLoading(true);

      const mergedMetadata: Record<string, string> = {
        ...metadata,
      };

      const result = await onCheckout(mergedMetadata);

      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading || disabled}
    >
      {isLoading ? (
        <>
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
