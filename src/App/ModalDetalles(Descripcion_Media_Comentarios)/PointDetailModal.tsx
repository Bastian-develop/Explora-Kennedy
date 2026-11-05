import { useState, useRef } from 'react';
import type { PointOfInterest } from '../../types';
import CommentSection from '../Comentarios/CommentSection';
import './PointDetailModal.css';

interface PointDetailModalProps {
  point: PointOfInterest;
  onClose: () => void;
}

const CassettePlayer = ({ podcast }: { podcast: { url: string, title?: string } }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const retryCountRef = useRef(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {
          console.warn('No se pudo reproducir el audio.');
        });
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.volume = volume;
      retryCountRef.current = 0; // Reset retry counter on successful load
    }
  };

  const handleError = () => {
    // Solo reintentar una vez para evitar bucle infinito de errores
    if (retryCountRef.current < 1 && audioRef.current) {
      retryCountRef.current += 1;
      audioRef.current.load();
    } else {
      console.warn('No se pudo cargar el audio después de reintentar.');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
      setProgress(Number(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`cassette-component ${isPlaying ? 'playing' : ''}`}>
      <div className="cassette-tape">
        <div className="cassette-screw screw-tl"></div>
        <div className="cassette-screw screw-tr"></div>
        <div className="cassette-screw screw-bl"></div>
        <div className="cassette-screw screw-br"></div>

        <div className="cassette-sticker">
          <div className="cassette-title-bar">
            <span>KENNEDY ARCHIVE</span>
            <span>SIDE A</span>
          </div>
          
          <div className="cassette-window">
            <div className="cassette-tape-line"></div>
            <div className="cassette-reel cassette-reel-left">
              <div className="reel-center">
                <div className="reel-teeth"></div>
              </div>
            </div>
            <div className="cassette-reel cassette-reel-right">
              <div className="reel-center">
                <div className="reel-teeth"></div>
              </div>
            </div>
          </div>
          
          <h4 className="cassette-title">{podcast.title || 'Grabación en Cinta'}</h4>
        </div>

        <div className="cassette-bottom">
          <div className="trap-hole"></div>
          <div className="trap-hole"></div>
          <div className="trap-hole"></div>
        </div>
      </div>

      {/* VINTAGE DECK CONTROLS */}
      <div className="deck-controls-container">
        <div className="deck-progress-section">
          <span className="deck-time">{formatTime(progress)}</span>
          <input
            type="range"
            className="deck-slider"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
          />
          <span className="deck-time">{formatTime(duration)}</span>
        </div>

        <div className="deck-lower-controls">
          <div className="deck-buttons">
            <button className="deck-btn" onClick={handleStop} title="Detener">
              <span className="deck-btn-icon">■</span>
              <span className="deck-btn-label">STOP</span>
            </button>

            <button className={`deck-btn ${isPlaying ? 'active' : ''}`} onClick={togglePlay} title={isPlaying ? "Pausar" : "Reproducir"}>
              <span className="deck-btn-icon">{isPlaying ? "❚❚" : "▶"}</span>
              <span className="deck-btn-label">{isPlaying ? "PAUSE" : "PLAY"}</span>
            </button>
          </div>

          <div className="deck-mixer">
            <span className="mixer-icon">{volume === 0 ? "🔇" : "🔉"}</span>
            <input
              type="range"
              className="deck-slider volume-slider"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              title="Volumen"
            />
          </div>
        </div>

        <audio
          ref={audioRef}
          src={podcast.url}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); setProgress(0); }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          preload="metadata"
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

const PointDetailModal = ({ point, onClose }: PointDetailModalProps) => {
  // Separamos los medios
  const allImages = point.media.filter(m => m.type === 'image');
  const allVideos = point.media.filter(m => m.type === 'video');
  const allPodcasts = point.media.filter(m => m.type === 'podcast');

  const coverImage = allImages.length > 0 ? allImages[0] : null;
  const galleryImages = allImages; // Mostrar TODAS las imágenes en la galería para que siempre haya fotos interactivas

  // Estado para la sección activa (en vez de mostrar todo de golpe)
  const [activeSection, setActiveSection] = useState<'historia' | 'galeria' | 'videos' | 'podcasts' | 'comentarios'>('historia');

  // Estado para la imagen en pantalla completa (Lightbox)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const carouselRef = useRef<HTMLDivElement>(null);
  const documentBodyRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const moveGallery = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (carousel) carousel.scrollBy({ left: direction * carousel.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <div
      className="fullscreen-overlay"
      onClick={onClose}
    >

      {/* Contenido real del modal que entra por fade sin obstruir la animación */}
      <div className="fullscreen-content-fadein" onClick={(e) => e.stopPropagation()}>

        {/* Botón flotante círculo */}
        <div className="close-button-wrapper">
          <button className="sticky-close-button" onClick={onClose} title="Cerrar y Volver">&times;</button>
          <span className="close-hint">Salir</span>
        </div>

        <div className="fullscreen-scroll-container" ref={scrollContainerRef} onClick={(e) => e.stopPropagation()}>

          {/* 1. SECCIÓN DE PORTADA / HERO */}
          <div className="fs-hero-section">
            {coverImage ? (
              <img
                src={coverImage.url}
                alt={coverImage.title}
                className="fs-hero-bg"
              />
            ) : (
              <div className="fs-hero-bg-fallback"></div>
            )}
            <div className="fs-hero-gradient"></div>
            <div className="fs-hero-content">
              <span className="fs-category-pill">EXPLORA KENNEDY</span>
              <h1 className="fs-title">{point.name}</h1>
            </div>
          </div>

          {/* 2. CUERPO DEL DOCUMENTO */}
          <div className="fs-document-body" ref={documentBodyRef}>

            {/* MENÚ DE ANCLAJES / PESTAÑAS (STICKY) */}
            <div className="fs-sticky-nav">
              <button
                className={activeSection === 'historia' ? 'active' : ''}
                onClick={() => setActiveSection('historia')}>Cronicas</button>
              <button
                className={activeSection === 'galeria' ? 'active' : ''}
                onClick={() => setActiveSection('galeria')}>Imágenes</button>
              <button
                className={activeSection === 'videos' ? 'active' : ''}
                onClick={() => setActiveSection('videos')}>Videos</button>
              <button
                className={activeSection === 'podcasts' ? 'active' : ''}
                onClick={() => setActiveSection('podcasts')}>Podcasts</button>
              <button
                className={activeSection === 'comentarios' ? 'active' : ''}
                onClick={() => setActiveSection('comentarios')}>Comentarios</button>
            </div>

            <div className="fs-section-wrapper">
              {/* --- HISTORIA --- */}
              {activeSection === 'historia' && (
                <section className="fs-section fs-history fade-in">
                  <h2 className="section-title">Historia</h2>
                  <p className="fs-description">{point.description}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fs-location-data"
                    title="Abrir ubicación en Google Maps"
                  >
                    <span className="location-link-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none"><path d="M20 10.2c0 5.1-8 11.1-8 11.1S4 15.3 4 10.2a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/><path d="M3 4.5 7 3l4 1.5L16 3l5 1.5v14L16 20l-5-1.5L7 20l-4-1.5v-14Z"/></svg>
                    </span>
                    <span className="location-link-copy"><strong>Cómo llegar</strong><small>Ver este lugar en Google Maps</small></span>
                    <span className="location-link-arrow" aria-hidden="true">↗</span>
                  </a>
                  <div className="location-coordinates" aria-label="Coordenadas geográficas de este lugar">
                    <span className="coordinates-heading"><span aria-hidden="true">⌖</span> Coordenadas del lugar</span>
                    <div className="coordinates-values">
                      <div><span>Latitud</span><code>{point.latitude.toFixed(6)}°</code></div>
                      <div><span>Longitud</span><code>{point.longitude.toFixed(6)}°</code></div>
                    </div>
                  </div>
                </section>
              )}

              {/* --- CARRUSEL DE IMÁGENES --- */}
              {activeSection === 'galeria' && (
                <section className="fs-section fs-gallery fade-in">
                  <h2 className="section-title">Galería Fotográfica</h2>
                  {galleryImages.length > 0 ? (
                    <>
                    <div className="gallery-controls" aria-label="Controles de la galería">
                      <span>Desliza o usa las flechas para ver las fotos</span>
                      <div>
                        <button type="button" onClick={() => moveGallery(-1)} aria-label="Ver fotos anteriores">←</button>
                        <button type="button" onClick={() => moveGallery(1)} aria-label="Ver fotos siguientes">→</button>
                      </div>
                    </div>
                    <div className="fs-carousel" ref={carouselRef}>
                      {galleryImages.map((img, idx) => (
                      <div key={idx} className="carousel-item">
                        <img
                          src={img.url}
                          alt={img.title || `Galería ${idx + 1}`}
                          onClick={() => setLightboxImage(img.url)}
                          className="polaroid-photo"
                        />
                        {img.title && <span className="carousel-caption">{img.title}</span>}
                      </div>
                    ))}
                    </div>
                    </>
                  ) : (
                    <p className="no-media-text">Aún no hay fotografías adicionales registradas en este archivo.</p>
                  )}
                </section>
              )}

              {/* --- VIDEOS --- */}
              {activeSection === 'videos' && (
                <section className="fs-section fs-videos fade-in">
                  <h2 className="section-title">Cortometrajes y Videos</h2>
                  {allVideos.length > 0 ? (
                    <div className="fs-video-grid">
                      {allVideos.map((vid, idx) => (
                        <div key={idx} className="video-card cinema-screen-wrapper">
                          <div className="cinema-stage">
                            <div className="cinema-screen-container">
                              {vid.url.includes('youtube.com/embed') ? (
                                <iframe 
                                  src={vid.url} 
                                  className="cinema-video"
                                  allowFullScreen 
                                  title={vid.title}
                                ></iframe>
                              ) : (
                                <video 
                                  src={vid.url} 
                                  controls 
                                  className="cinema-video"
                                  preload="metadata"
                                  crossOrigin="anonymous"
                                >
                                  <p>Tu navegador no soporta video HTML5. Por favor actualiza tu navegador.</p>
                                </video>
                              )}
                              <div className="cinema-projector-glow"></div>
                            </div>
                          </div>
                          {vid.title && <h4 className="media-card-title cinema-title">{vid.title}</h4>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-media-text">No existen cintas de video registradas para esta ubicación por el momento.</p>
                  )}
                </section>
              )}

              {/* --- PODCASTS --- */}
              {activeSection === 'podcasts' && (
                <section className="fs-section fs-podcasts fade-in">
                  <h2 className="section-title">Archivo Sonoro (Podcasts)</h2>
                  {allPodcasts.length > 0 ? (
                    <div className="fs-podcast-list">
                      {allPodcasts.map((pod, idx) => (
                        <CassettePlayer key={idx} podcast={pod} />
                      ))}
                    </div>
                  ) : (
                    <p className="no-media-text">El fonógrafo de este punto está vacío. No hay grabaciones sonoras.</p>
                  )}
                </section>
              )}

              {/* --- COMENTARIOS --- */}
              {activeSection === 'comentarios' && (
                <section className="fs-section fs-comments fade-in">
                  <h2 className="section-title">Libro de Visitas (Comentarios)</h2>
                  <div className="fs-comments-wrapper">
                    <CommentSection pointId={point.id} />
                  </div>
                </section>
              )}
            </div>

            <div className="fs-footer">
              <p>♦ Fin del Recorrido ♦</p>
            </div>

          </div>
        </div>
      </div>

      {/* Lightbox Fullscreen Overlay */}
      {lightboxImage && (
        <div
          className="lightbox-overlay"
          onClick={(e) => {
            e.stopPropagation(); // BUG FIX: Evitar que el click cierre TODO el mapa
            setLightboxImage(null);
          }}
        >
          <button className="lightbox-close">&times;</button>
          <img src={lightboxImage} alt="Imagen expandida" className="lightbox-image" />
        </div>
      )}
    </div>
  );
};

export default PointDetailModal;
