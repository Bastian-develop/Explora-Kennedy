import './AdminAuthModal.css';

interface RegisterAdminModalProps {
  onClose: () => void;
}

const RegisterAdminModal = ({ onClose }: RegisterAdminModalProps) => (
  <div className="admin-auth-overlay" onClick={onClose}>
    <div className="admin-auth-card" onClick={event => event.stopPropagation()}>
      <button className="auth-close-btn" onClick={onClose} title="Cerrar">&times;</button>
      <div className="auth-header">
        <div className="auth-decoration-line"></div>
        <h2 className="auth-title">Nuevo administrador</h2>
        <div className="auth-decoration-line"></div>
      </div>
      <p className="auth-text">
        Por seguridad, las cuentas administrativas no se crean desde una pantalla pública.
        El responsable del proyecto debe crear la cuenta en Supabase Authentication y autorizarla en la tabla administrators.
      </p>
      <button type="button" className="auth-submit-btn" onClick={onClose}>ENTENDIDO</button>
      <div className="auth-stamp">ACCESO CONTROLADO</div>
    </div>
  </div>
);

export default RegisterAdminModal;
