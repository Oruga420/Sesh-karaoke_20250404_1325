import React, { useState } from 'react';
import { Recording } from '../services/lyricsService';

interface Props { onSearch: (requested: Recording) => void; initial: Recording | null }
function ManualLyricsSearch({ onSearch, initial }: Props) {
  const [title, setTitle] = useState(initial?.title || '');
  const [artist, setArtist] = useState(initial?.artist || '');
  const [album, setAlbum] = useState(initial?.album || '');
  return <form className="manual-search" aria-label="Find lyrics" onSubmit={event => {
    event.preventDefault();
    if (title.trim() && artist.trim()) onSearch({ title: title.trim(), artist: artist.trim(), album: album.trim(), duration: 0 });
  }}>
    <h2>Find lyrics</h2>
    <p>Search online with a song title and artist. Spotify login is optional.</p>
    <div className="manual-search__fields">
      <label htmlFor="lyrics-title">Song title<input id="lyrics-title" name="title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} autoComplete="off" /></label>
      <label htmlFor="lyrics-artist">Artist<input id="lyrics-artist" name="artist" required maxLength={200} value={artist} onChange={event => setArtist(event.target.value)} autoComplete="off" /></label>
      <label htmlFor="lyrics-album">Album (optional)<input id="lyrics-album" name="album" maxLength={200} value={album} onChange={event => setAlbum(event.target.value)} autoComplete="off" /></label>
    </div>
    <button type="submit">Find lyrics</button>
  </form>;
}
export default ManualLyricsSearch;
