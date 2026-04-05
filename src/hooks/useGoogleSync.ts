import { useState, useEffect, useCallback, useRef } from 'react';
import { db, logActivity } from '../db/db';
import { 
  listDriveFiles, 
  downloadFromDrive, 
  uploadToDrive, 
  updateFileInDrive, 
  createFolder,
  refreshGoogleToken 
} from '../lib/googleDrive';

const BACKUP_FILE_NAME = 'backup.json';
const BACKUP_FOLDER_NAME = 'App Backup';

export const useGoogleSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(!!localStorage.getItem('google_drive_token'));
  
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getValidToken = async () => {
    const token = localStorage.getItem('google_drive_token');
    const refreshToken = localStorage.getItem('google_drive_refresh_token');
    
    if (!token) return null;
    
    // Simple check: try to list files to see if token is still valid
    try {
      await listDriveFiles(token, 'test-connection');
      return token;
    } catch (err: any) {
      if (refreshToken) {
        try {
          const newTokens = await refreshGoogleToken(refreshToken);
          localStorage.setItem('google_drive_token', newTokens.access_token);
          return newTokens.access_token;
        } catch (refreshErr) {
          console.error('Failed to refresh token', refreshErr);
          localStorage.removeItem('google_drive_token');
          localStorage.removeItem('google_drive_refresh_token');
          setIsConnected(false);
          return null;
        }
      }
      return null;
    }
  };

  const getBackupFolderId = async (token: string) => {
    const folders = await listDriveFiles(token, BACKUP_FOLDER_NAME);
    const folder = folders.files?.find((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
    
    if (folder) return folder.id;
    
    const newFolder = await createFolder(token, BACKUP_FOLDER_NAME);
    return newFolder.id;
  };

  const performRestore = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;

    setIsSyncing(true);
    setError(null);

    try {
      const folderId = await getBackupFolderId(token);
      const files = await listDriveFiles(token, BACKUP_FILE_NAME, folderId);
      const backupFile = files.files?.[0];

      if (backupFile) {
        const content = await downloadFromDrive(token, backupFile.id);
        const data = JSON.parse(content);

        // Restore to IndexedDB
        const tables = Object.keys(data);
        for (const table of tables) {
          if ((db as any)[table]) {
            await (db as any)[table].clear();
            await (db as any)[table].bulkAdd(data[table]);
          }
        }

        await logActivity('Auto Sync Restore', 'Data automatically restored from Google Drive');
        setLastSyncTime(new Date());
        console.log('Data Restored Successfully');
      } else {
        console.log('No backup file found, starting fresh');
      }
    } catch (err: any) {
      console.error('Sync Restore Error:', err);
      setError('Sync Error');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const performBackup = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;

    setIsSyncing(true);
    setError(null);

    try {
      const folderId = await getBackupFolderId(token);
      const files = await listDriveFiles(token, BACKUP_FILE_NAME, folderId);
      const backupFile = files.files?.[0];

      // Prepare data
      const backupData: any = {};
      const tables = ['medicines', 'categories', 'suppliers', 'invoices', 'purchases', 'expenses', 'staff', 'returns', 'activityLogs', 'settings', 'users'];
      for (const table of tables) {
        backupData[table] = await (db as any)[table].toArray();
      }
      const content = JSON.stringify(backupData, null, 2);

      if (backupFile) {
        await updateFileInDrive(token, backupFile.id, content);
      } else {
        await uploadToDrive(token, BACKUP_FILE_NAME, content, folderId);
      }

      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Sync Backup Error:', err);
      setError('Sync Error');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const triggerSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    
    // Debounce sync to avoid too many API calls
    syncTimeoutRef.current = setTimeout(() => {
      performBackup();
    }, 3000);
  }, [performBackup]);

  // Initial restore on mount if connected
  useEffect(() => {
    if (isConnected) {
      performRestore();
    }
  }, [isConnected, performRestore]);

  return {
    isSyncing,
    lastSyncTime,
    error,
    isConnected,
    triggerSync,
    performRestore,
    performBackup
  };
};
