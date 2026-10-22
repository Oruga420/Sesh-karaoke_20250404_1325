import React, { useState } from 'react';
import { Recording } from '../services/lyricsService';

interface Props { onSearch: (requested: Recording) => void; initial: Recording | null; titleInputRef?: React.RefObject<HTMLInputElement> }
function ManualLyricsSearch({ onSearch, initial, titleInputRef }: Props) {
  const [title, setTitle] = useState(initial?.title || '');
  const [artist, setArtist] = useState(initial?.artist || '');
  const [album, setAlbum] = useState(initial?.album || '');
  return <form className="manual-search" aria-label="Buscar letras" onSubmit={event => {
    event.preventDefault();
    if (title.trim() && artist.trim()) onSearch({ title: title.trim(), artist: artist.trim(), album: album.trim(), duration: 0 });
  }}>
    <span className="manual-search__eyebrow">ENCUENTRA TU PRÓXIMO TEMAZO</span>
    <h2>Busca tu canción</h2>
    <p>Título, artista y tú poniendo la voz.</p>
    <div className="manual-search__fields">
      <label htmlFor="lyrics-title">Título<input ref={titleInputRef} id="lyrics-title" name="title" placeholder="Nombre de la canción" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} autoComplete="off" /></label>
      <label htmlFor="lyrics-artist">Artista<input id="lyrics-artist" name="artist" placeholder="Quién la canta" required maxLength={200} value={artist} onChange={event => setArtist(event.target.value)} autoComplete="off" /></label>
    </div>
    <details className="manual-search__album"><summary>Añadir álbum, opcional</summary>
      <label htmlFor="lyrics-album">Álbum<input id="lyrics-album" name="album" maxLength={200} value={album} onChange={event => setAlbum(event.target.value)} autoComplete="off" /></label>
    </details>
    <button className="primary-button manual-search__submit" type="submit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>Buscar letras</button>
    <p className="manual-search__hint">Spotify es opcional. Las ganas de cantar, no.</p>
  </form>;
}
export default ManualLyricsSearch;
