import React from 'react';
import { WorkspaceView } from '@/components/composer/WorkspaceView';

export const metadata = {
  title: 'Verification Workspace — Afterfact',
  description: 'Submit AI-generated answers or questions to decompose into verifiable atomic claims with temporal provenance.',
};

export default function AppPage() {
  return (
    <div className="w-full min-h-screen pt-20 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto flex flex-col justify-start">
      <WorkspaceView />
    </div>
  );
}
