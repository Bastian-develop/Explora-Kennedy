import { useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../src/lib/supabaseClient';
import './AdminAuthModal.css';

interface ManageAdminsModalProps {
  onClose: () => void;
  onOpenCreate: () => void;
}

const ManageAdminsModal = ({ onClose, onOpenCreate }: ManageAdminsModalProps) => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        setAdmins([]);
        return;
      }
      const { data, error } = await supabase
        .from('administrators')
        .select('id, email, created_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching admins:', error);
      } else if (data) {
        setAdmins(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    const { data: currentSession } = await supabase.auth.getUser();
    if (currentSession.user?.id === id) {
      alert('No puedes revocar tu propia cuenta mientras tienes la sesión activa.');
      return;
    }
    if (window.confirm(`/// ALERTA DE SEGURIDAD ///\n\n¿Estás seguro que deseas revocar el acceso y eliminar permanentemente al administrador:\n\n${email}\n\nEsta acción no se puede deshacer.`)) {
      try {
        const { error } = await supabase
          .from('administrators')
          .delete()
          .eq('id', id);
        
        if (error) {
          alert(`Error al eliminar: ${error.message}`);
        } else {
          // Actualizar estado local
          setAdmins(prev => prev.filter(admin => admin.email !== email));
          
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="admin-auth-overlay" onClick={onClose}>
      <div className="admin-add-place-modal manage-places-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose} title="Cerrar">&times;</button>
        
        <h3>Directorio de Administradores</h3>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
          <button 
            className="sidebar-btn-map" 
            style={{ width: 'auto', padding: '8px 15px', fontSize: '0.9rem' }}
            onClick={() => {
              onClose();
              onOpenCreate();
            }}
          >
            + Reclutar Nuevo Admin
          </button>
        </div>

        <div className="manage-places-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#666' }}>Cargando expedientes...</p>
          ) : !isSupabaseConfigured ? (
            <p style={{ textAlign: 'center', color: '#666' }}>Conecta Supabase para consultar las cuentas autorizadas.</p>
          ) : admins.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666' }}>No hay administradores registrados.</p>
          ) : (
            admins.map(admin => (
              <div key={admin.id || admin.email} className="manage-place-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="manage-place-name" style={{ display: 'block', fontSize: '1.1rem' }}>{admin.email}</span>
                  <span style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginTop: '4px' }}>Cuenta autorizada</span>
                </div>
                <div className="manage-place-actions">
                  <button className="manage-action-btn delete-btn" onClick={() => handleDelete(admin.id, admin.email)} title="Revocar Acceso">
                    🗑️ Revocar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageAdminsModal;
