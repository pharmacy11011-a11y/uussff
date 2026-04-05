/**
 * Google Drive Service
 * Handles OAuth flow and file operations for Google Drive.
 * This file uses standard fetch to avoid Node.js dependencies in the browser.
 */

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export const getAuthUrl = (clientId: string, redirectUri: string) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
};

export const exchangeCodeForToken = async (code: string, redirectUri: string) => {
  try {
    const response = await fetch('/api/google/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirectUri }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to exchange token');
    }

    return await response.json();
  } catch (error) {
    console.error('Error exchanging Google code:', error);
    throw error;
  }
};

export const refreshGoogleToken = async (refreshToken: string) => {
  try {
    const response = await fetch('/api/google/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to refresh token');
    }

    return await response.json();
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    throw error;
  }
};

export const uploadToDrive = async (
  accessToken: string,
  fileName: string,
  fileContent: string,
  folderId?: string,
  mimeType: string = 'application/json'
) => {
  try {
    const metadata = {
      name: fileName,
      parents: folderId ? [folderId] : [],
    };

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/related; boundary=foo_bar_baz',
      },
      body: `--foo_bar_baz\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--foo_bar_baz\r\nContent-Type: ${mimeType}\r\n\r\n${fileContent}\r\n--foo_bar_baz--`,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to upload to Google Drive');
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
};

export const updateFileInDrive = async (
  accessToken: string,
  fileId: string,
  fileContent: string,
  mimeType: string = 'application/json'
) => {
  try {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: fileContent,
    });

    if (!response.ok) throw new Error('Failed to update file in Google Drive');
    return await response.json();
  } catch (error) {
    console.error('Error updating file in Google Drive:', error);
    throw error;
  }
};

export const createFolder = async (accessToken: string, folderName: string) => {
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!response.ok) throw new Error('Failed to create folder');
    return await response.json();
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
};

export const listDriveFiles = async (accessToken: string, fileName?: string, folderId?: string) => {
  try {
    let query = 'trashed = false';
    if (fileName) query += ` and name = '${fileName}'`;
    if (folderId) query += ` and '${folderId}' in parents`;
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, createdTime, mimeType)&orderBy=createdTime desc`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to list files from Google Drive');
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing Google Drive files:', error);
    throw error;
  }
};

export const downloadFromDrive = async (accessToken: string, fileId: string) => {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download file from Google Drive');
    }

    return await response.text();
  } catch (error) {
    console.error('Error downloading from Google Drive:', error);
    throw error;
  }
};
