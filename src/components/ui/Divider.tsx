'use client';

import React from 'react';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  className?: string;
}

export function Divider({ className = '', ...props }: DividerProps) {
  return (
    <hr
      className={`border-0 border-t border-border-subtle my-6 ${className}`}
      {...props}
    />
  );
}
