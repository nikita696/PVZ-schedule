import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const toasterStyle = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
} satisfies Record<string, string>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    style={toasterStyle as CSSProperties}
    {...props}
  />
);

export { Toaster };
