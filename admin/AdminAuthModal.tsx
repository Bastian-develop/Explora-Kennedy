import { useEffect, useState, type FormEvent } from 'react';
import { isSupabaseConfigured, supabase } from '../src/lib/supabaseClient';
import './AdminAuthModal.css';

interface AdminAuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

type AuthView = 'login' | 'forgot' | 'force-change-password';

const AdminAuthModal = ({ onSuccess, onClose }: AdminAuthModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [view, setView] = useState<AuthView>('login');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('adminRecovery') === '1' || window.location.hash.includes('type=recovery')) {
      setView('force-change-password');
    }
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setView('force-change-password');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      if (!isSupabaseConfigured) {
        setMessage('La conexión con la base de datos aún no está configurada.');
        return;
      }

      if (view === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password
        });
        if (error || !data.user) throw new Error('Correo o contraseña incorrectos.');

        const { data: admin, error: adminError } = await supabase
          .from('administrators')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (adminError || !admin) {
          await supabase.auth.signOut();
          throw new Error('Esta cuenta no tiene permisos de administración.');
        }
        onSuccess();
        return;
      }

      if (view === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
          redirectTo: `${window.location.origin}/?adminRecovery=1`
        });
        if (error) throw error;
        setMessage('Si el correo corresponde a una cuenta, recibirá instrucciones para restablecer la contraseña.');
        return;
      }

      if (newPassword.length < 8) {
        setMessage('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setMessage('Las contraseñas no coinciden.');
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('El enlace de recuperación no es válido o ya venció.');
      const { data: admin, error: adminError } = await supabase
        .from('administrators')
        .select('id')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (adminError || !admin) throw new Error('Esta cuenta no tiene permisos de administración.');

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error de autenticación:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  const title = view === 'login' ? 'Confidencial' : view === 'forgot' ? 'Restablecer acceso' : 'Nueva contraseña';

  return (
    <div className="admin-auth-overlay" onClick={onClose}>
      <div className="admin-auth-card" onClick={event => event.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose} title="Cerrar">&times;</button>
        <div className="auth-header">
          <div className="auth-decoration-line"></div>
          <h2 className="auth-title">{title}</h2>
          <div className="auth-decoration-line"></div>
        </div>

        <p className="auth-text">
          {view === 'login' && (isSupabaseConfigured
            ? 'Ingrese con la cuenta autorizada para administrar Explora Kennedy.'
            : 'La base de datos no está conectada. Puedes entrar en modo local para revisar el panel en este navegador.')}
          {view === 'forgot' && 'Ingrese el correo de su cuenta para recibir un enlace de recuperación.'}
          {view === 'force-change-password' && 'Escriba una nueva contraseña para completar la recuperación del acceso.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {view !== 'force-change-password' && (
            <input
              type="email"
              className="auth-input"
              placeholder="[ CORREO ]"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoFocus
              required
              disabled={isLoading}
            />
          )}
          {view === 'login' && (
            <input
              type="password"
              className="auth-input"
              placeholder="[ CONTRASEÑA ]"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
              disabled={isLoading}
            />
          )}
          {view === 'force-change-password' && (
            <>
              <input
                type="password"
                className="auth-input"
                placeholder="[ NUEVA CONTRASEÑA ]"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                autoFocus
                minLength={8}
                required
                disabled={isLoading}
              />
              <input
                type="password"
                className="auth-input"
                placeholder="[ CONFIRMAR CONTRASEÑA ]"
                value={confirmNewPassword}
                onChange={event => setConfirmNewPassword(event.target.value)}
                minLength={8}
                required
                disabled={isLoading}
              />
            </>
          )}

          {message && <p className="auth-error-text" role="status">{message}</p>}
          <button type="submit" className="auth-submit-btn" disabled={isLoading || !isSupabaseConfigured}>
            {isLoading ? 'PROCESANDO...' : view === 'login' ? 'INGRESAR' : view === 'forgot' ? 'ENVIAR ENLACE' : 'ACTUALIZAR CONTRASEÑA'}
          </button>

          {!isSupabaseConfigured && import.meta.env.DEV && view === 'login' && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={onSuccess}
              disabled={isLoading}
            >
              Entrar en modo local de demostración
            </button>
          )}

          {view === 'login' && (
            <button type="button" className="auth-link-btn" onClick={() => { setView('forgot'); setMessage(''); }} disabled={isLoading}>
              ¿Olvidó su contraseña?
            </button>
          )}
          {view === 'forgot' && (
            <button type="button" className="auth-link-btn" onClick={() => { setView('login'); setMessage(''); }} disabled={isLoading}>
              Volver al inicio de sesión
            </button>
          )}
        </form>
        {!isSupabaseConfigured && <p className="auth-text" role="note">En este modo, los cambios quedan en el navegador y no se comparten. El acceso local solo aparece durante el desarrollo.</p>}
        <div className="auth-stamp">SELLO OFICIAL</div>
      </div>
    </div>
  );
};

export default AdminAuthModal;
