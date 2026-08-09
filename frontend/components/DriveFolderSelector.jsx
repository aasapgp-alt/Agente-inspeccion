'use client';

import React from 'react';
import { DriveMobile } from './campo/drive/DriveMobile';

export default function DriveFolderSelector({ token, onSelectFolder, initialFolderId = '', onClose }) {
  return (
    <DriveMobile
      token={token}
      onSelectFolder={onSelectFolder}
      initialFolderId={initialFolderId}
      onClose={onClose}
    />
  );
}
