# Configurar la base de datos de Explora Kennedy

El proyecto usa Supabase (PostgreSQL). `schema.sql` crea las tablas, activa políticas de acceso, crea la función de me gusta y carga los cuatro lugares que actualmente están definidos en el código.

## Configuración inicial

1. Crear un proyecto Supabase en una cuenta controlada por el equipo o la institución.
2. En el panel del proyecto, abrir **SQL Editor**, pegar el contenido de `schema.sql` y ejecutarlo una sola vez.
3. En **Authentication > Users**, crear la primera cuenta administradora con su correo y contraseña. Confirmar/verificar el correo desde el panel.
4. Sustituir `admin@ejemplo.com` al final de `schema.sql` por el correo real y ejecutar únicamente la instrucción comentada de alta inicial para agregar el ID de ese usuario a `public.administrators`.
5. En **Authentication > URL Configuration**, agregar las direcciones de retorno del sitio local y del dominio publicado para que funcionen los enlaces de recuperación de contraseña.
6. Copiar `.env.example` como `.env.local` y reemplazar los dos valores con el Project URL y la clave publicable/anon que aparecen en **Project Settings > API**.
7. Reiniciar el servidor local. Para publicar el sitio, configurar esas mismas dos variables en el panel de variables de entorno de la plataforma de alojamiento y volver a desplegar.

## Seguridad

- No almacenar contraseñas en la tabla `administrators`; las contraseñas pertenecen a Supabase Auth.
- No poner `service_role` en el frontend, en `.env.local` con prefijo `VITE_`, ni en el repositorio.
- La creación de administradores queda fuera del formulario público. El responsable crea la cuenta en Authentication y la autoriza agregando su `auth.users.id` a `public.administrators`.
- El público puede leer lugares y comentarios y publicar comentarios. Solo administradores autenticados pueden cambiar lugares o moderar comentarios. Los visitantes no pueden leer los correos de otros comentaristas.
- El conteo de “me gusta” se modifica mediante `increment_comment_likes`, sin permitir que el navegador cambie arbitrariamente el resto del comentario.
- Las imágenes nuevas se cargan al bucket público `place-media`; las escrituras solo están permitidas para administradores autorizados. Se aceptan JPG, PNG y WEBP de hasta 10 MB. Los medios que ya están dentro de `public/` pueden seguir usando sus rutas actuales.

## Persistencia mientras no se configura Supabase

La aplicación sigue funcionando en modo local. Los puntos iniciales están en `src/data/puntos`; las ediciones locales quedan en `localStorage` de ese navegador. Sin la base configurada, esas ediciones no se comparten con otros dispositivos. Al conectarse a un Supabase nuevo, `schema.sql` carga inicialmente los cuatro puntos como datos de nube. Las imágenes agregadas sin conexión se guardan localmente como datos del navegador; después de conectar Supabase, las nuevas imágenes subidas se almacenan en Storage.
