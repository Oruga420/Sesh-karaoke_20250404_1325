import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export interface SyncedLyrics {
  text: string;
  synced: {
    time: number;
    words: string[];
  }[];
}

export const fetchLyrics = async (title: string, artist: string): Promise<SyncedLyrics> => {
  try {
    const response = await axios.get(`${API_URL}/api/lyrics`, {
      params: { title, artist }
    });
    
    return response.data.lyrics;
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    throw new Error('Failed to fetch lyrics');
  }
};

// Function to convert synced lyrics to a display format
export const formatSyncedLyrics = (synced: SyncedLyrics): any[] => {
  return synced.synced.map(line => {
    return line.words.map(word => ({
      word,
      timestamp: line.time
    }));
  });
};
