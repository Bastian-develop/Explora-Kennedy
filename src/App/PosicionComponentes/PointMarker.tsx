import { useEffect, useMemo, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import L from 'leaflet';
import type { PointOfInterest } from '../../types';
import './PointMarker.css';

interface PointMarkerProps {
  point: PointOfInterest;
  onSelect: () => void;
  onOpenDetail: () => void;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isFirstVisit?: boolean;
}

const PointMarker = ({ point, onSelect, onOpenDetail, isSelected, isHighlighted, isFirstVisit }: PointMarkerProps) => {
  const markerRef = useRef<LeafletMarker | null>(null);
  const firstImage = point.media.find(media => media.type === 'image');
  const icon = useMemo(() => L.divIcon({
    className: 'explora-leaflet-marker',
    html: `<span class="explora-marker-pin ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${isFirstVisit ? 'is-first-visit' : ''}">${firstImage ? `<img src="${firstImage.url}" alt="" />` : '<span>EK</span>'}</span>`,
    iconSize: [48, 56], iconAnchor: [24, 52], popupAnchor: [0, -48],
  }), [firstImage, isSelected, isHighlighted, isFirstVisit]);

  useEffect(() => {
    if (isSelected) markerRef.current?.openPopup();
  }, [isSelected]);

  useEffect(() => {
    const markerElement = markerRef.current?.getElement();
    if (!markerElement) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      onSelect();
      markerRef.current?.openPopup();
    };

    markerElement.addEventListener('keydown', handleKeyDown);
    return () => markerElement.removeEventListener('keydown', handleKeyDown);
  }, [onSelect, point.id]);

  return <Marker ref={markerRef} position={[point.latitude, point.longitude]} icon={icon} keyboard title={point.name} alt={`Ubicar ${point.name}`} eventHandlers={{ click: onSelect }}>
    <Popup className="explora-place-popup">
      <div className="explora-popup-content">
        {firstImage && <img src={firstImage.url} alt={point.name} />}
        <div><strong>{point.name}</strong><p>{point.description}</p><button type="button" onClick={onOpenDetail}>Abrir historia <span aria-hidden="true">→</span></button></div>
      </div>
    </Popup>
  </Marker>;
};

export default PointMarker;
