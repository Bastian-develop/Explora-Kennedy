export interface Comment {
  id: string;
  author: string;
  email?: string;
  text: string;
  date: string;
  likes?: number;
}

export interface Media {
  type: 'image' | 'video' | 'podcast';
  url: string;
  title: string;
  thumbnail?: string; // para videos/podcasts si aplica
}

export interface PointOfInterest {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  media: Media[];
  comments: Comment[];
}
