import { useState, useEffect, type FormEvent } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { PointOfInterest } from '../../types';
import { uploadPlaceImage } from '../../lib/uploadPlaceImage';

interface ManagePlacesModalProps {
  onClose: () => void;
}

const ManagePlacesModal = ({ onClose }: ManagePlacesModalProps) => {
  const { points, deletePoint, editPoint, previewPoint, setPreviewPoint } = useAppContext();
  const [editingPoint, setEditingPoint] = useState<PointOfInterest | null>(null);
  
  // Edit Form States
  const [editStep, setEditStep] = useState(1);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLatitude, setEditLatitude] = useState(4.625);
  const [editLongitude, setEditLongitude] = useState(-74.145);
  const [editVideoLink, setEditVideoLink] = useState('');
  const [editPodcastLink, setEditPodcastLink] = useState('');
  
  const [editCoverImage, setEditCoverImage] = useState<File | null>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Sync preview point when editing a place
  useEffect(() => {
    if (editingPoint && editStep === 2) {
      setPreviewPoint({ latitude: editLatitude, longitude: editLongitude });
    } else {
      setPreviewPoint(null);
    }
  }, [editLatitude, editLongitude, editStep, editingPoint, setPreviewPoint]);

  useEffect(() => {
    if (editingPoint && editStep === 2 && previewPoint) {
      setEditLatitude(previewPoint.latitude);
      setEditLongitude(previewPoint.longitude);
    }
  }, [editingPoint, editStep, previewPoint]);

  const handleClose = () => {
    setPreviewPoint(null);
    onClose();
  };

  const handleDelete = (point: PointOfInterest) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar "${point.name}"?`)) {
      deletePoint(point.id);
    }
  };

  const goToNextEditStep = () => {
    if (editStep === 1 && (!editName.trim() || !editDescription.trim())) {
      alert('Por favor completa el nombre y la historia.');
      return;
    }
    if (editStep === 2 && (!Number.isFinite(editLatitude) || !Number.isFinite(editLongitude))) {
      alert('Ingresa una latitud y longitud válidas antes de continuar.');
      return;
    }
    setEditStep(current => Math.min(current + 1, 3));
  };

  const goToPreviousEditStep = () => {
    if (editStep > 1) {
      setEditStep(current => Math.max(current - 1, 1));
      return;
    }
    setPreviewPoint(null);
    setEditingPoint(null);
  };

  const startEdit = (point: PointOfInterest) => {
    setEditingPoint(point);
    setEditName(point.name);
    setEditDescription(point.description);
    setEditLatitude(point.latitude);
    setEditLongitude(point.longitude);
    
    const video = point.media.find(m => m.type === 'video');
    const podcast = point.media.find(m => m.type === 'podcast');
    
    setEditVideoLink(video ? video.url : '');
    setEditPodcastLink(podcast ? podcast.url : '');
    setEditCoverImage(null);
    setNewImages([]);
    setEditStep(1);
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPoint) return;

    // Nunca guardar/cerrar la edición desde los pasos 1 o 2.
    if (editStep < 3) {
      goToNextEditStep();
      return;
    }

    setIsSaving(true);

    try {
      const currentMedia = [...editingPoint.media];
      let imageMedia = currentMedia.filter(m => m.type === 'image');
      const nonImageMedia = currentMedia.filter(m => m.type !== 'image');

      if (editCoverImage) {
        const newCover = {
          type: 'image' as const,
          url: await uploadPlaceImage(editCoverImage, editingPoint.id),
          title: 'Portada'
        };
        if (imageMedia.length > 0) imageMedia[0] = newCover;
        else imageMedia = [newCover];
      }

      if (newImages.length > 0) {
        const carouselItems = await Promise.all(newImages.map(async file => ({
          type: 'image' as const,
          url: await uploadPlaceImage(file, editingPoint.id),
          title: file.name
        })));
        const cover = imageMedia.length > 0 ? [imageMedia[0]] : [];
        imageMedia = [...cover, ...carouselItems];
      }

      let finalMedia = [...imageMedia, ...nonImageMedia];
      finalMedia = finalMedia.filter(m => m.type !== 'video');
      if (editVideoLink.trim()) finalMedia.push({ type: 'video', url: editVideoLink.trim(), title: 'Video' });
      finalMedia = finalMedia.filter(m => m.type !== 'podcast');
      if (editPodcastLink.trim()) finalMedia.push({ type: 'podcast', url: editPodcastLink.trim(), title: 'Podcast' });

      editPoint(editingPoint.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        latitude: editLatitude,
        longitude: editLongitude,
        media: finalMedia
      });

      setPreviewPoint(null);
      setEditingPoint(null);
    } catch (error) {
      console.error('No se pudieron guardar los cambios:', error);
      alert(error instanceof Error ? `No se pudieron guardar los cambios: ${error.message}` : 'No se pudieron guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (editStep < 3) {
      goToNextEditStep();
      return;
    }
    void handleSaveEdit(event);
  };

  return (
    <div className={`admin-add-place-overlay ${editingPoint && editStep === 2 ? 'preview-mode' : ''}`} onClick={handleClose}>
      <div className="admin-add-place-modal manage-places-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={handleClose} title="Cerrar">&times;</button>
        
        {!editingPoint ? (
          <>
            <h3>Gestionar Lugares</h3>
            <p style={{ fontSize: '0.8rem', color: '#388e3c', margin: '-10px 0 15px', fontStyle: 'italic' }}>
              ☁️ Los cambios se sincronizan automáticamente para todos los visitantes.
            </p>
            <div className="manage-places-list">
              {points.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666' }}>No hay lugares documentados.</p>
              ) : (
                points.map(point => (
                  <div key={point.id} className="manage-place-item">
                    <span className="manage-place-name">{point.name}</span>
                    <div className="manage-place-actions">
                      <button className="manage-action-btn edit-btn" onClick={() => startEdit(point)} title="Editar">
                        ✏️ Editar
                      </button>
                      <button className="manage-action-btn delete-btn" onClick={() => handleDelete(point)} title="Eliminar">
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <h3>Editar lugar (Paso {editStep} de 3)</h3>
            <form className="admin-add-place-form" onSubmit={handleEditFormSubmit}>
              {editStep === 1 && (
                <>
                  <label>
                    Nombre del lugar
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Historia
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      required
                    />
                  </label>
                </>
              )}

              {editStep === 2 && (
                <>
                <p className="map-location-help">Haz clic en el mapa para ubicar el sitio; también puedes ajustar las coordenadas.</p>
                <div className="coordinates-group">
                  <label>
                    Latitud
                    <input
                      type="number"
                      step="0.0001"
                      value={editLatitude}
                      onChange={(e) => setEditLatitude(Number(e.target.value))}
                      required
                    />
                  </label>
                  <label>
                    Longitud
                    <input
                      type="number"
                      step="0.0001"
                      value={editLongitude}
                      onChange={(e) => setEditLongitude(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>
                </>
              )}

              {editStep === 3 && (
                <>
                  <label>
                    Foto de portada principal (reemplazar)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setEditCoverImage(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  <label>
                    Fotos del carrusel (reemplazar carrusel actual)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setNewImages(Array.from(e.target.files));
                        }
                      }}
                    />
                  </label>

                  <label>
                    Link del video
                    <input
                      type="url"
                      value={editVideoLink}
                      onChange={(e) => setEditVideoLink(e.target.value)}
                      placeholder="https://"
                    />
                  </label>

                  <label>
                    Link del podcast
                    <input
                      type="url"
                      value={editPodcastLink}
                      onChange={(e) => setEditPodcastLink(e.target.value)}
                      placeholder="https://"
                    />
                  </label>
                </>
              )}

              <div className="form-navigation-buttons">
                <button type="button" className="sidebar-btn-map" style={{ background: '#755f46' }} onClick={goToPreviousEditStep}>
                  {editStep > 1 ? 'Atrás' : 'Cancelar'}
                </button>
                
                {editStep < 3 ? (
                  <button type="button" className="sidebar-btn-map" onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    goToNextEditStep();
                  }}>
                    Siguiente
                  </button>
                ) : (
                  <button className="sidebar-btn-map" type="submit" disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ManagePlacesModal;
