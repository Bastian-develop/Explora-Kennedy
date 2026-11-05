import { useEffect, useState, type FormEvent } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { uploadPlaceImage } from '../../lib/uploadPlaceImage';
import { trackAnalyticsEvent } from '../../lib/GoogleAnalytics';
import PointMarker from '../PosicionComponentes/PointMarker';
import PointDetailModal from '../ModalDetalles(Descripcion_Media_Comentarios)/PointDetailModal';
import InfoModal from '../AcercaProyecto/InfoModal';
import AdminAuthModal from '../../../admin/AdminAuthModal';
import AdminLogoutModal from '../../../admin/AdminLogoutModal';
import ManagePlacesModal from '../AdminLugares/ManagePlacesModal';
import type { PointOfInterest } from '../../types';
import PlacesStatsModal from '../AdminLugares/PlacesStatsModal';
import RegisterAdminModal from '../../../admin/RegisterAdminModal';
import ManageAdminsModal from '../../../admin/ManageAdminsModal';
import ManageCommentsModal from '../../../admin/ManageCommentsModal';
import './Map.css';

const MapSelectionController = ({ point }: { point: PointOfInterest | null }) => {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), 15), { animate: true });
  }, [map, point]);
  return null;
};

const MapClickPicker = ({ enabled, onPick }: { enabled: boolean; onPick: (latitude: number, longitude: number) => void }) => {
  useMapEvents({ click: event => {
    const target = event.originalEvent.target;
    const clickedMarker = target instanceof Element && Boolean(target.closest('.leaflet-marker-icon, .leaflet-popup'));
    if (enabled && !clickedMarker) onPick(event.latlng.lat, event.latlng.lng);
  } });
  return null;
};

const Map = () => {
  const { points, isAdmin, setIsAdmin, addPoint, isFirstVisit, markFirstVisitDone, visitedPoints, markPointAsVisited, previewPoint, setPreviewPoint, registerPointVisit } = useAppContext();
  const [selectedPoint, setSelectedPoint] = useState<PointOfInterest | null>(null);
  const [kennedyBoundary, setKennedyBoundary] = useState<GeoJsonObject | null>(null);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [isPlacesPanelCollapsed, setIsPlacesPanelCollapsed] = useState(() =>
    window.matchMedia('(max-width: 768px)').matches
  );
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showAdminLogout, setShowAdminLogout] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceDescription, setNewPlaceDescription] = useState('');
  const [newVideoLink, setNewVideoLink] = useState('');
  const [newPodcastLink, setNewPodcastLink] = useState('');
  const [newCoverImage, setNewCoverImage] = useState<File | null>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [newPlaceLatitude, setNewPlaceLatitude] = useState(4.625);
  const [newPlaceLongitude, setNewPlaceLongitude] = useState(-74.145);
  const [addPlaceStep, setAddPlaceStep] = useState(1);
  const [showManagePlacesModal, setShowManagePlacesModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showRegisterAdminModal, setShowRegisterAdminModal] = useState(false);
  const [showManageAdminsModal, setShowManageAdminsModal] = useState(false);
  const [showManageCommentsModal, setShowManageCommentsModal] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('adminRecovery') === '1') {
      setShowAdminAuth(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      where: "LOCNOMBRE='KENNEDY'",
      outFields: 'LOCNOMBRE',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
    });

    fetch(`https://mapas.gobiernobogota.gov.co/waserver/rest/services/Mapa_Base/MapServer/4/query?${params}`, {
      signal: controller.signal,
      cache: 'force-cache',
    })
      .then(response => {
        if (!response.ok) throw new Error(`Boundary request failed: ${response.status}`);
        return response.json();
      })
      .then((data: GeoJsonObject) => {
        if ('type' in data && data.type === 'FeatureCollection') setKennedyBoundary(data);
        else throw new Error('The locality boundary response was not GeoJSON.');
      })
      .catch(error => {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('No se pudo cargar el límite oficial de Kennedy:', error);
        }
      });

    return () => controller.abort();
  }, []);

  const closeModal = () => setSelectedPoint(null);

  const selectPlacePreview = (point: PointOfInterest) => {
    if (selectedPreviewId !== point.id) {
      markFirstVisitDone();
      markPointAsVisited(point.id);
      registerPointVisit(point.id);
    }
    setSelectedPreviewId(point.id);
  };

  const openPlaceDetail = (point: PointOfInterest) => {
    trackAnalyticsEvent('open_place', { place_name: point.name });
    selectPlacePreview(point);
    setSelectedPoint(point);
  };

  const handleMapLocationPick = (latitude: number, longitude: number) => {
    if (showAddPlaceModal && addPlaceStep === 2) {
      setNewPlaceLatitude(Number(latitude.toFixed(6)));
      setNewPlaceLongitude(Number(longitude.toFixed(6)));
    } else if (showManagePlacesModal && previewPoint) {
      setPreviewPoint({ latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) });
    }
  };

  const handleAdminAccessClick = () => {
    if (isAdmin) {
      setShowAdminLogout(true);
    } else {
      setShowAdminAuth(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setShowAdminAuth(false);
  };

  const handleAdminLogoutConfirm = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setShowAdminLogout(false);
  };

  const handleCoverImageChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      setNewCoverImage(files[0]);
    } else {
      setNewCoverImage(null);
    }
  };

  const handleImageFilesChange = (files: FileList | null) => {
    if (!files) return;
    setNewImages(Array.from(files));
  };

  const handleAddPlace = async (event: FormEvent) => {
    event.preventDefault();
    if (!newPlaceName.trim() || !newPlaceDescription.trim()) return;
    setIsAddingPlace(true);
    try {
      const coverMedia = newCoverImage ? [{
        type: 'image' as const,
        url: await uploadPlaceImage(newCoverImage, 'uploads'),
        title: 'Portada - ' + newCoverImage.name
      }] : [];

      const carouselMedia = await Promise.all(
        newImages.map(async file => ({
          type: 'image' as const,
          url: await uploadPlaceImage(file, 'uploads'),
          title: file.name
        }))
      );

      const media: PointOfInterest['media'] = [
        ...coverMedia,
        ...carouselMedia,
        ...(newVideoLink.trim() ? [{ type: 'video' as const, url: newVideoLink.trim(), title: 'Video' }] : []),
        ...(newPodcastLink.trim() ? [{ type: 'podcast' as const, url: newPodcastLink.trim(), title: 'Podcast' }] : [])
      ];

      addPoint({
        name: newPlaceName.trim(),
        description: newPlaceDescription.trim(),
        latitude: newPlaceLatitude,
        longitude: newPlaceLongitude,
        media,
      });

      setNewPlaceName('');
      setNewPlaceDescription('');
      setNewVideoLink('');
      setNewPodcastLink('');
      setNewCoverImage(null);
      setNewImages([]);
      setNewPlaceLatitude(4.625);
      setNewPlaceLongitude(-74.145);
      setShowAddPlaceModal(false);
      setAddPlaceStep(1);
    } catch (error) {
      console.error('No se pudo guardar el lugar:', error);
      alert(error instanceof Error ? `No se pudo guardar el lugar: ${error.message}` : 'No se pudo guardar el lugar.');
    } finally {
      setIsAddingPlace(false);
    }
  };

  return (
    <div className={`map-container${isPlacesPanelCollapsed ? ' places-panel-collapsed' : ''}`}>
      <MapContainer center={[4.625, -74.145]} zoom={13} minZoom={11} maxZoom={19} scrollWheelZoom={false} zoomControl={false} className="kennedy-map" aria-label="Mapa interactivo de la localidad de Kennedy">
        <ZoomControl position="topright" />
        <MapSelectionController point={points.find(point => point.id === selectedPreviewId) ?? null} />
        <MapClickPicker enabled={(showAddPlaceModal && addPlaceStep === 2) || (showManagePlacesModal && previewPoint !== null)} onPick={handleMapLocationPick} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Límite local: <a href="https://mapas.gobiernobogota.gov.co/waserver/rest/services/Mapa_Base/MapServer/4">Mapa Base Bogotá</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {kennedyBoundary && <GeoJSON data={kennedyBoundary} style={{ color: '#fff8ea', weight: 8, opacity: 0.95, fillOpacity: 0 }} interactive={false} />}
        {kennedyBoundary && <GeoJSON data={kennedyBoundary} style={{ color: '#d1562b', weight: 3.5, opacity: 1, fillColor: '#d1562b', fillOpacity: 0.035 }} interactive={false} />}
        {previewPoint && <CircleMarker center={[previewPoint.latitude, previewPoint.longitude]} radius={11} pathOptions={{ color: "#d1562b", fillColor: "#f6b44b", fillOpacity: 0.9, weight: 3 }} />}
        {showAddPlaceModal && addPlaceStep === 2 && <CircleMarker center={[newPlaceLatitude, newPlaceLongitude]} radius={10} pathOptions={{ color: "#d1562b", fillColor: "#f6b44b", fillOpacity: 0.9, weight: 3 }} />}
        {points.map(point => <PointMarker key={point.id} point={point} onSelect={() => selectPlacePreview(point)} onOpenDetail={() => openPlaceDetail(point)} isSelected={selectedPreviewId === point.id} isHighlighted={hoveredPointId === point.id} isFirstVisit={isFirstVisit} />)}
      </MapContainer>
      {/* Map Overlay Controls */}
      <div className="map-overlay">

        {/* Top Header */}
        <div className="map-header" style={{ position: 'relative' }}>
          <div className="map-title-container" style={{ background: 'transparent', boxShadow: 'none', backdropFilter: 'none', padding: 0, marginLeft: '-20px', marginTop: '-20px' }}>
            <img
              src="/img/LOGO_EXPLORA_kENNEDY.png"
              alt="Explora Kennedy Transmedia"
              className="logo-overlay"
              style={{ maxWidth: '260px', height: 'auto', objectFit: 'contain', cursor: 'help' }}
              onClick={handleAdminAccessClick}
              title="Explora Kennedy"
            />
          </div>

          <div className="map-controls-top-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a
              href="https://www.uniagustiniana.edu.co"
              target="_blank"
              rel="noopener noreferrer"
              className="uni-logo-link"
              title="Ir a Uniagustiniana"
            >
              <img
                src="/img/logo_universidad.png"
                alt="Logo Universidad"
                style={{ maxWidth: '160px', height: 'auto', filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))', cursor: 'pointer' }}
              />
            </a>
            <button className={`icon-btn dark-btn ${isFirstVisit ? 'first-visit-pulse' : ''}`} onClick={() => { markFirstVisitDone(); setIsInfoOpen(true); }}>i</button>
          </div>
        </div>

        {/* Sidebar Menu for Points */}
        <div className={`map-sidebar${isPlacesPanelCollapsed ? ' is-collapsed' : ''}`}>
          <div className="map-sidebar-heading">
            <div className="map-sidebar-title-group">
              <h3 className="sidebar-title">{isAdmin ? 'Panel de gestión' : 'Lugares documentados'}</h3>
              <span className="sidebar-count">{points.length} {points.length === 1 ? 'lugar' : 'lugares'}</span>
            </div>
            <button
              type="button"
              className="sidebar-collapse-btn"
              aria-expanded={!isPlacesPanelCollapsed}
              aria-controls="map-place-list"
              onClick={() => setIsPlacesPanelCollapsed(collapsed => !collapsed)}
            >
              <span>{isPlacesPanelCollapsed ? (isAdmin ? 'Ver opciones' : 'Ver lugares') : 'Ocultar'}</span>
              <span aria-hidden="true" className="sidebar-collapse-icon">{isPlacesPanelCollapsed ? '⌃' : '⌄'}</span>
            </button>
          </div>
          {!isAdmin && <p className="map-exploration-hint">Toca un marcador o elige un lugar de la lista para descubrir su historia.</p>}
          {isAdmin ? (
            <ul className="sidebar-list" id="map-place-list">
              <li className="sidebar-item admin-sidebar-item">
                <div className="sidebar-item-icon">
                  <span style={{ fontSize: '1.4rem' }}>📊</span>
                </div>
                <div className="sidebar-item-info">
                  <span className="sidebar-item-name">Google Analytics</span>
                  <button
                    className="sidebar-btn-map"
                    type="button"
                    onClick={() => window.open('https://analytics.google.com/analytics/web/', '_blank')}
                  >
                    Acceder al flujo
                  </button>
                </div>
              </li>
              <li className="sidebar-item admin-sidebar-item">
                <div className="sidebar-item-icon">
                  <span style={{ fontSize: '1.4rem' }}>➕</span>
                </div>
                <div className="sidebar-item-info">
                  <span className="sidebar-item-name">Agregar lugar</span>
                  <button
                    className="sidebar-btn-map"
                    type="button"
                    onClick={() => { setAddPlaceStep(1); setShowAddPlaceModal(true); }}
                  >
                    Abrir formulario
                  </button>
                </div>
              </li>
              <li className="sidebar-item admin-sidebar-item">
                <div className="sidebar-item-icon">
                  <span style={{ fontSize: '1.4rem' }}>⚙️</span>
                </div>
                <div className="sidebar-item-info">
                  <span className="sidebar-item-name">Gestionar lugares</span>
                  <button
                    className="sidebar-btn-map"
                    type="button"
                    onClick={() => setShowManagePlacesModal(true)}
                  >
                    Abrir gestor
                  </button>
                </div>
              </li>
              <li className="sidebar-item admin-sidebar-item">
                <div className="sidebar-item-icon">
                  <span style={{ fontSize: '1.4rem' }}>💬</span>
                </div>
                <div className="sidebar-item-info">
                  <span className="sidebar-item-name">Auditoría Comentarios</span>
                  <button
                    className="sidebar-btn-map"
                    type="button"
                    onClick={() => setShowManageCommentsModal(true)}
                  >
                    Abrir registros
                  </button>
                </div>
              </li>
              <li className="sidebar-item admin-sidebar-item">
                <div className="sidebar-item-icon">
                  <span style={{ fontSize: '1.4rem' }}>👥</span>
                </div>
                <div className="sidebar-item-info">
                  <span className="sidebar-item-name">Directorio de Admins</span>
                  <button
                    className="sidebar-btn-map"
                    type="button"
                    onClick={() => setShowManageAdminsModal(true)}
                  >
                    Ver personal
                  </button>
                </div>
              </li>
            </ul>
          ) : (
            <ul className="sidebar-list" id="map-place-list">
              {points.map((point) => {
                const firstImage = point.media.find(m => m.type === 'image');
                return (
                  <li
                    key={point.id}
                    className={`sidebar-item ${selectedPreviewId === point.id ? 'selected-place' : ''}`}
                    onMouseEnter={() => setHoveredPointId(point.id)}
                    onMouseLeave={() => setHoveredPointId(null)}
                  >
                    <button
                      type="button"
                      className="sidebar-item-icon"
                      aria-label={`Ubicar ${point.name} en el mapa`}
                      aria-pressed={selectedPreviewId === point.id}
                      onClick={() => selectPlacePreview(point)}
                    >
                      {firstImage ? (
                        <img src={firstImage.url} alt={point.name} />
                      ) : (
                        <span style={{ fontSize: '1.2rem' }}>📍</span>
                      )}
                    </button>
                    <div className="sidebar-item-info">
                      <span className="sidebar-item-name">{point.name}</span>
                      <button
                        className={`sidebar-btn-map ${isFirstVisit ? 'first-visit-pulse' : ''}`}
                        aria-pressed={selectedPreviewId === point.id}
                        onClick={() => selectPlacePreview(point)}
                      >
                        Ubicar en mapa
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>



        {/* Bottom Elements */}
        <div className="map-bottom-container">
          {!isAdmin && (
            <div className="map-stats-box">
              <div className="tag-clip"></div>
              <div className="tag-eyelet"></div>
              <span className="stats-label">Progreso de exploración</span>
              <span className="stats-number">
                {Math.min(visitedPoints.filter(id => points.some(p => p.id === id)).length, points.length)} / {points.length}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Detalle del Punto */}
      {selectedPoint && (
        <PointDetailModal
          point={selectedPoint}
          onClose={closeModal}
        />
      )}

      {isInfoOpen && (
        <InfoModal onClose={() => setIsInfoOpen(false)} />
      )}

      {showStatsModal && (
        <PlacesStatsModal onClose={() => setShowStatsModal(false)} />
      )}

      {showAdminAuth && (
        <AdminAuthModal
          onSuccess={handleAdminLoginSuccess}
          onClose={() => setShowAdminAuth(false)}
        />
      )}

      {showAdminLogout && (
        <AdminLogoutModal
          onConfirm={handleAdminLogoutConfirm}
          onClose={() => setShowAdminLogout(false)}
        />
      )}

      {showAddPlaceModal && (
        <div className={`admin-add-place-overlay ${addPlaceStep === 2 ? 'preview-mode' : ''}`} onClick={() => { setShowAddPlaceModal(false); setAddPlaceStep(1); }}>
          <div className="admin-add-place-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close-btn" onClick={() => { setShowAddPlaceModal(false); setAddPlaceStep(1); }} title="Cerrar">&times;</button>
            <h3>Agregar nuevo lugar (Paso {addPlaceStep} de 3)</h3>
            {addPlaceStep === 2 && <p className="map-location-help">Haz clic en el mapa para ubicar el sitio; también puedes ajustar las coordenadas.</p>}
            <form className="admin-add-place-form" onSubmit={handleAddPlace}>
              {addPlaceStep === 1 && (
                <>
                  <label>
                    Nombre del lugar
                    <input
                      type="text"
                      value={newPlaceName}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Historia
                    <textarea
                      value={newPlaceDescription}
                      onChange={(e) => setNewPlaceDescription(e.target.value)}
                      rows={4}
                      required
                    />
                  </label>
                </>
              )}

              {addPlaceStep === 2 && (
                <div className="coordinates-group">
                  <label>
                    Latitud
                    <input
                      type="number"
                      step="0.0001"
                      value={newPlaceLatitude}
                      onChange={(e) => setNewPlaceLatitude(Number(e.target.value))}
                      required
                    />
                  </label>
                  <label>
                    Longitud
                    <input
                      type="number"
                      step="0.0001"
                      value={newPlaceLongitude}
                      onChange={(e) => setNewPlaceLongitude(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>
              )}

              {addPlaceStep === 3 && (
                <>
                  <label>
                    Foto de portada principal
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleCoverImageChange(e.target.files)}
                      required
                    />
                  </label>

                  <label>
                    Fotos del carrusel (puedes seleccionar varias)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => handleImageFilesChange(e.target.files)}
                    />
                  </label>

                  <label>
                    Link del video
                    <input
                      type="url"
                      value={newVideoLink}
                      onChange={(e) => setNewVideoLink(e.target.value)}
                      placeholder="https://"
                    />
                  </label>

                  <label>
                    Link del podcast
                    <input
                      type="url"
                      value={newPodcastLink}
                      onChange={(e) => setNewPodcastLink(e.target.value)}
                      placeholder="https://"
                    />
                  </label>
                </>
              )}

              <div className="form-navigation-buttons">
                {addPlaceStep > 1 ? (
                  <button type="button" className="sidebar-btn-map" onClick={() => setAddPlaceStep(prev => prev - 1)}>
                    Atrás
                  </button>
                ) : (
                  <div></div>
                )}

                {addPlaceStep < 3 ? (
                  <button
                    type="button"
                    className="sidebar-btn-map"
                    onClick={() => {
                      if (addPlaceStep === 1 && (!newPlaceName.trim() || !newPlaceDescription.trim())) {
                        alert('Por favor completa el nombre y la historia.');
                        return;
                      }
                      setAddPlaceStep(prev => prev + 1)
                    }}
                  >
                    Siguiente
                  </button>
                ) : (
                  <button className="sidebar-btn-map" type="submit" disabled={isAddingPlace}>
                    {isAddingPlace ? 'Guardando...' : 'Agregar lugar'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showManagePlacesModal && (
        <ManagePlacesModal onClose={() => setShowManagePlacesModal(false)} />
      )}

      {showRegisterAdminModal && (
        <RegisterAdminModal onClose={() => setShowRegisterAdminModal(false)} />
      )}

      {showManageAdminsModal && (
        <ManageAdminsModal
          onClose={() => setShowManageAdminsModal(false)}
          onOpenCreate={() => setShowRegisterAdminModal(true)}
        />
      )}

      {showManageCommentsModal && (
        <ManageCommentsModal onClose={() => setShowManageCommentsModal(false)} />
      )}

      {isAdmin && (
        <button
          className="stats-toggle-btn"
          onClick={() => setShowStatsModal(true)}
        >
          📊 Datos de lugares
        </button>
      )}
    </div>
  );
};

export default Map;


