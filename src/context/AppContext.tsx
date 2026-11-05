/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { PointOfInterest, Comment } from '../types';
import { allPoints } from '../data/puntos';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export interface PointStats {
  daily: number;
  weekly: number;
  monthly: number;
  chatbotQueries: number;
}

export type PointStatsMap = Record<string, PointStats>;

export interface WeeklyHistory {
  visits: number[]; // [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]
  chatbot: number[]; // [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]
}

export interface MonthlyHistory {
  visits: number[]; // [Ene, Feb, ... Dic]
  chatbot: number[]; // [Ene, Feb, ... Dic]
}

interface AppContextType {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  points: PointOfInterest[];
  addPoint: (point: Omit<PointOfInterest, 'id' | 'comments'>) => void;
  editPoint: (id: string, updates: Partial<PointOfInterest>) => void;
  deletePoint: (id: string) => void;
  addComment: (pointId: string, comment: Comment) => void;
  editComment: (pointId: string, commentId: string, newText: string) => void;
  deleteComment: (pointId: string, commentId: string) => void;
  likeComment: (pointId: string, commentId: string) => void;
  isFirstVisit: boolean;
  markFirstVisitDone: () => void;
  visitedPoints: string[];
  markPointAsVisited: (id: string) => void;
  previewPoint: { latitude: number; longitude: number } | null;
  setPreviewPoint: (point: { latitude: number; longitude: number } | null) => void;
  pointStats: PointStatsMap;
  registerPointVisit: (id: string) => void;
  registerPointChatQuery: (id: string) => void;
  weeklyHistory: WeeklyHistory;
  monthlyHistory: MonthlyHistory;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewPoint, setPreviewPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(() => {
    const visited = localStorage.getItem('kennedy_first_visit');
    return !visited;
  });
  const [visitedPoints, setVisitedPoints] = useState<string[]>(() => {
    const saved = localStorage.getItem('kennedy_visited_points');
    return saved ? JSON.parse(saved) : [];
  });

  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyHistory>(() => {
    const saved = localStorage.getItem('kennedy_weekly_history_real');
    return saved ? JSON.parse(saved) : {
      visits: [0, 0, 0, 0, 0, 0, 0],
      chatbot: [0, 0, 0, 0, 0, 0, 0]
    };
  });

  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistory>(() => {
    const saved = localStorage.getItem('kennedy_monthly_history_real');
    return saved ? JSON.parse(saved) : {
      visits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      chatbot: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
  });

  const [points, setPoints] = useState<PointOfInterest[]>(() => {
    const saved = localStorage.getItem('kennedy_points');
    if (saved) {
      try {
        const parsedSaved: PointOfInterest[] = JSON.parse(saved);
        // Recuperamos también lugares añadidos desde el panel y conservamos los cambios locales.
        const savedById = new Map(parsedSaved.map(point => [point.id, point]));
        const restored = parsedSaved.map(savedPoint => {
          const staticPoint = allPoints.find(point => point.id === savedPoint.id);
          return staticPoint
            ? { ...staticPoint, ...savedPoint, comments: savedPoint.comments || staticPoint.comments }
            : savedPoint;
        });
        allPoints.forEach(staticPoint => {
          if (!savedById.has(staticPoint.id)) restored.push(staticPoint);
        });
        return restored;
      } catch (e) {
        console.error("Error al parsear puntos guardados, limpiando memoria.", e);
        localStorage.removeItem('kennedy_points');
        return allPoints;
      }
    }
    return allPoints;
  });

  // Restablecer el acceso administrativo desde una sesión real de Supabase.
  useEffect(() => {
    // Elimina el antiguo almacén de contraseñas en texto plano de este navegador.
    localStorage.removeItem('kennedy_admins');
    let active = true;
    const verifyAdmin = async (userId?: string) => {
      if (!isSupabaseConfigured || !userId) {
        if (active) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from('administrators')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (active) setIsAdmin(!error && Boolean(data));
    };

    supabase.auth.getSession().then(({ data }) => verifyAdmin(data.session?.user.id));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void verifyAdmin(session?.user.id);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Efecto global para cargar lugares de la nube (Supabase) al inicio
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const fetchGlobalPlaces = async () => {
      try {
        const { data, error } = await supabase
          .from('global_state')
          .select('data')
          .eq('id', 'places_v1')
          .single();
        
        if (!error && data && data.data) {
          // Si encontramos lugares en la nube, usamos esos
          const migrated = (data.data as Array<Record<string, unknown>>).map(place => {
            const known = allPoints.find(point => point.id === place.id);
            if (known) return { ...place, latitude: known.latitude, longitude: known.longitude };
            if (typeof place.latitude === 'number' && typeof place.longitude === 'number') return place;
            const oldX = typeof place.x === 'number' ? place.x : 50;
            const oldY = typeof place.y === 'number' ? place.y : 50;
            return { ...place, latitude: 4.66 - oldY * 0.00065, longitude: -74.19 + oldX * 0.0009 };
          }) as unknown as PointOfInterest[];
          setPoints(migrated);
          // Y actualizamos el caché local
          localStorage.setItem('kennedy_points', JSON.stringify(migrated));
        }
      } catch (err) {
        console.error('Error al sincronizar con la nube:', err);
      }
    };
    fetchGlobalPlaces();
  }, []);

  const [pointStats, setPointStats] = useState<PointStatsMap>(() => {
    const saved = localStorage.getItem('kennedy_point_stats_real');
    const savedDate = localStorage.getItem('kennedy_stats_last_date');
    const today = new Date().toISOString().split('T')[0];

    let stats: PointStatsMap = {};

    if (saved) {
      try {
        stats = JSON.parse(saved);
      } catch (e) {
        console.error("Error al parsear estadísticas guardadas", e);
      }
    }

    if (Object.keys(stats).length === 0) {
      allPoints.forEach(p => {
        stats[p.id] = {
          daily: 0,
          weekly: 0,
          monthly: 0,
          chatbotQueries: 0
        };
      });
      localStorage.setItem('kennedy_stats_last_date', today);
    } else if (savedDate && savedDate !== today) {
      const lastDate = new Date(savedDate);
      const currentDate = new Date(today);

      const isNewWeek = lastDate.getDay() > currentDate.getDay() ||
        (currentDate.getTime() - lastDate.getTime() > 7 * 24 * 60 * 60 * 1000);

      const isNewMonth = lastDate.getMonth() !== currentDate.getMonth() ||
        lastDate.getFullYear() !== currentDate.getFullYear();

      Object.keys(stats).forEach(id => {
        const item = stats[id];
        item.daily = 0;

        if (isNewWeek) {
          item.weekly = 0;
        }
        if (isNewMonth) {
          item.monthly = 0;
        }
      });

      localStorage.setItem('kennedy_stats_last_date', today);
    }

    return stats;
  });

  // ==========================================
  // DISPARAR DESCARGA DE COMENTARIOS DESDE SUPABASE EN VIVO
  // ==========================================
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const fetchLiveComments = async () => {
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('id, point_id, author, text, likes, created_at')
          .order('created_at', { ascending: true });

        if (error) {
          console.error("Error al descargar comentarios de Supabase:", error);
          return;
        }

        if (data) {
          setPoints(prevPoints =>
            prevPoints.map(point => {
              const liveCommentsForPoint = data
                .filter((c: { point_id: string; id: string; author: string; text: string; created_at: string; likes: number }) => c.point_id === point.id)
                .map((c: { point_id: string; id: string; author: string; text: string; created_at: string; likes: number }) => ({
                  id: c.id,
                  author: c.author,
                  text: c.text,
                  date: c.created_at,
                  likes: c.likes || 0
                }));

              return { ...point, comments: liveCommentsForPoint };
            })
          );
        }
      } catch (err) {
        console.error("Falla al descargar comentarios de Supabase:", err);
      }
    };

    fetchLiveComments();
  }, []);

  useEffect(() => {
    localStorage.setItem('kennedy_points', JSON.stringify(points));
  }, [points]);

  useEffect(() => {
    localStorage.setItem('kennedy_visited_points', JSON.stringify(visitedPoints));
  }, [visitedPoints]);

  useEffect(() => {
    localStorage.setItem('kennedy_point_stats_real', JSON.stringify(pointStats));
  }, [pointStats]);

  useEffect(() => {
    localStorage.setItem('kennedy_weekly_history_real', JSON.stringify(weeklyHistory));
  }, [weeklyHistory]);

  useEffect(() => {
    localStorage.setItem('kennedy_monthly_history_real', JSON.stringify(monthlyHistory));
  }, [monthlyHistory]);

  const getDayIndex = () => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  };

  const getMonthIndex = () => {
    return new Date().getMonth();
  };

  const registerPointVisit = (id: string) => {
    setPointStats(prev => {
      const current = prev[id] || { daily: 0, weekly: 0, monthly: 0, chatbotQueries: 0 };
      return {
        ...prev,
        [id]: {
          ...current,
          daily: current.daily + 1,
          weekly: current.weekly + 1,
          monthly: current.monthly + 1,
        }
      };
    });

    const dayIdx = getDayIndex();
    const monthIdx = getMonthIndex();
    setWeeklyHistory(prev => {
      const nextVisits = [...prev.visits];
      nextVisits[dayIdx] = (nextVisits[dayIdx] || 0) + 1;
      return { ...prev, visits: nextVisits };
    });
    setMonthlyHistory(prev => {
      const nextVisits = [...prev.visits];
      nextVisits[monthIdx] = (nextVisits[monthIdx] || 0) + 1;
      return { ...prev, visits: nextVisits };
    });
  };

  const registerPointChatQuery = (id: string) => {
    setPointStats(prev => {
      const current = prev[id] || { daily: 0, weekly: 0, monthly: 0, chatbotQueries: 0 };
      return {
        ...prev,
        [id]: {
          ...current,
          chatbotQueries: current.chatbotQueries + 1,
        }
      };
    });

    const dayIdx = getDayIndex();
    const monthIdx = getMonthIndex();
    setWeeklyHistory(prev => {
      const nextChatbot = [...prev.chatbot];
      nextChatbot[dayIdx] = (nextChatbot[dayIdx] || 0) + 1;
      return { ...prev, chatbot: nextChatbot };
    });
    setMonthlyHistory(prev => {
      const nextChatbot = [...prev.chatbot];
      nextChatbot[monthIdx] = (nextChatbot[monthIdx] || 0) + 1;
      return { ...prev, chatbot: nextChatbot };
    });
  };

  // ==========================================
  // SINCRONIZAR AGREGAR COMENTARIOS A SUPABASE
  // ==========================================
  const addComment = async (pointId: string, comment: Comment) => {
    // 1. Guardar en el estado local de React inmediatamente para respuesta ultra fluida (Optimistic Update)
    setPoints(prevPoints =>
      prevPoints.map(point => {
        if (point.id === pointId) {
          return { ...point, comments: [...point.comments, comment] };
        }
        return point;
      })
    );

    // 2. Guardar en Supabase en segundo plano
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('comments')
        .insert([{
          id: comment.id,
          point_id: pointId,
          author: comment.author,
          email: comment.email,
          text: comment.text,
          likes: comment.likes || 0,
          created_at: comment.date
        }]);
      if (error) console.error('Error de Supabase al guardar comentario:', error);
    } catch (err) {
      console.error("Error de red al guardar comentario en Supabase:", err);
    }
  };

  // ==========================================
  // SINCRONIZAR ELIMINAR COMENTARIOS EN SUPABASE
  // ==========================================
  const deleteComment = async (pointId: string, commentId: string) => {
    if (!isAdmin) return;
    // 1. Optimistic local update
    setPoints(prevPoints =>
      prevPoints.map(point => {
        if (point.id === pointId) {
          return { ...point, comments: point.comments.filter(c => c.id !== commentId) };
        }
        return point;
      })
    );

    // 2. Delete from Supabase
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      if (error) console.error('Error de Supabase al borrar comentario:', error);
    } catch (err) {
      console.error("Error de red al borrar comentario en Supabase:", err);
    }
  };

  // ==========================================
  // SINCRONIZAR EDITAR COMENTARIOS EN SUPABASE
  // ==========================================
  const editComment = async (pointId: string, commentId: string, newText: string) => {
    if (!isAdmin) return;
    // 1. Optimistic local update
    setPoints(prevPoints =>
      prevPoints.map(point => {
        if (point.id === pointId) {
          return {
            ...point,
            comments: point.comments.map(c =>
              c.id === commentId ? { ...c, text: newText } : c
            )
          };
        }
        return point;
      })
    );

    // 2. Update in Supabase
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('comments')
        .update({ text: newText })
        .eq('id', commentId);
      if (error) console.error('Error de Supabase al editar comentario:', error);
    } catch (err) {
      console.error("Error de red al editar comentario en Supabase:", err);
    }
  };

  // ==========================================
  // SINCRONIZAR ME GUSTA DE COMENTARIOS A SUPABASE
  // ==========================================
  const likeComment = async (pointId: string, commentId: string) => {
    if (!isSupabaseConfigured) {
      setPoints(prevPoints => prevPoints.map(point => point.id === pointId
        ? { ...point, comments: point.comments.map(comment => comment.id === commentId ? { ...comment, likes: (comment.likes || 0) + 1 } : comment) }
        : point));
      return;
    }
    try {
      const { data, error } = await supabase.rpc('increment_comment_likes', { p_comment_id: commentId });
      if (error) throw error;
      setPoints(prevPoints => prevPoints.map(point => point.id === pointId
        ? { ...point, comments: point.comments.map(comment => comment.id === commentId ? { ...comment, likes: data } : comment) }
        : point));
    } catch (err) {
      console.error('Error de Supabase al registrar el me gusta:', err);
    }
  };

  // ==========================================
  // AUTO-SINCRONIZAR LUGARES A SUPABASE (Para todo el mundo)
  // ==========================================
  const syncPlacesToCloud = async (updatedPoints: PointOfInterest[]) => {
    if (!isSupabaseConfigured || !isAdmin) return;
    try {
      // Los comentarios se guardan en su tabla privada; no se incluyen correos
      // personales dentro del JSON público de ubicaciones.
      const placesWithoutComments = updatedPoints.map(point => ({ ...point, comments: [] }));
      const { error } = await supabase
        .from('global_state')
        .upsert({ id: 'places_v1', data: placesWithoutComments });
      if (error) console.error('Error al sincronizar lugares con la nube:', error);
    } catch (err) {
      console.error('Error al sincronizar lugares con la nube:', err);
    }
  };

  const addPoint = (point: Omit<PointOfInterest, 'id' | 'comments'>) => {
    const newPoint: PointOfInterest = {
      ...point,
      id: crypto.randomUUID(),
      comments: []
    };
    setPoints(prevPoints => {
      const updated = [...prevPoints, newPoint];
      // Auto-sincronizar en segundo plano para todos los visitantes
      syncPlacesToCloud(updated);
      return updated;
    });
  };

  const editPoint = (id: string, updates: Partial<PointOfInterest>) => {
    setPoints(prevPoints => {
      const updated = prevPoints.map(point =>
        point.id === id ? { ...point, ...updates } : point
      );
      // Auto-sincronizar en segundo plano
      syncPlacesToCloud(updated);
      return updated;
    });
  };

  const deletePoint = (id: string) => {
    setPoints(prevPoints => {
      const updated = prevPoints.filter(point => point.id !== id);
      // Auto-sincronizar en segundo plano
      syncPlacesToCloud(updated);
      return updated;
    });
  };

  const markFirstVisitDone = () => {
    localStorage.setItem('kennedy_first_visit', 'true');
    setIsFirstVisit(false);
  };

  const markPointAsVisited = (id: string) => {
    setVisitedPoints(prev => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
  };

  return (
    <AppContext.Provider value={{ isAdmin, setIsAdmin, points, addPoint, editPoint, deletePoint, addComment, editComment, deleteComment, likeComment, isFirstVisit, markFirstVisitDone, visitedPoints, markPointAsVisited, previewPoint, setPreviewPoint, pointStats, registerPointVisit, registerPointChatQuery, weeklyHistory, monthlyHistory }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within a AppProvider');
  }
  return context;
};
