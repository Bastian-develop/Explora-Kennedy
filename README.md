# Mapa Interactivo de la Localidad de Kenedy

Este proyecto es un software interactivo que presenta un mapa detallado de la localidad de Kenedy, enfocándose en su rico patrimonio cultural. El mapa incluye puntos destacados de patrimonio, imágenes ilustrativas, y una narrativa histórica que explora la historia de Kenedy y sus elementos patrimoniales más significativos.

## Características

- **Mapa Interactivo**: Navega por la localidad de Kenedy con un mapa intuitivo.
- **Puntos de Patrimonio**: Descubre los lugares históricos y culturales marcados en el mapa.
- **Imágenes del Patrimonio**: Visualiza el patrimonio a través de una galería de imágenes.
- **Historia de Kenedy**: Lee sobre la historia de la localidad y sus patrimonios.
- **Interfaz Amigable**: Desarrollado con React y TypeScript para una experiencia fluida.

## Tecnologías Utilizadas

- **React**: Para la construcción de la interfaz de usuario.
- **TypeScript**: Para un desarrollo más robusto y tipado.
- **Vite**: Como herramienta de construcción rápida y eficiente.

## Base de datos

El proyecto está preparado para Supabase (PostgreSQL). El esquema, la carga inicial de los lugares y los pasos de configuración están en [`supabase/README.md`](supabase/README.md) y [`supabase/schema.sql`](supabase/schema.sql). Usa únicamente la URL del proyecto y la clave publicable/anon en el cliente; nunca expongas `service_role`.

## Instalación y Ejecución

1. Clona el repositorio:
   ```
   git clone https://github.com/daniel02260/Kenedy.git
   ```

2. Navega al directorio del proyecto:
   ```
   cd Kenedy
   ```

3. Instala las dependencias:
   ```
   npm install
   ```

4. Ejecuta el servidor de desarrollo:
   ```
   npm run dev
   ```

5. Abre tu navegador y ve a `http://localhost:5173` para ver la aplicación.

## Configuración del asistente virtual

El chat se conecta a Gemini mediante la función de servidor `api/chat.ts`. La clave debe permanecer en el servidor; no uses el prefijo `VITE_` ni la subas al repositorio.

- **En Vercel:** configura `GEMINI_API_KEY` en las variables de entorno del proyecto para los entornos de vista previa y producción. Después de guardarla, vuelve a desplegar el proyecto.
- **En local:** crea un archivo `.env.local` en la raíz con `GEMINI_API_KEY=tu_clave` y ejecuta la aplicación mediante `vercel dev` para que también esté disponible la función `/api/chat`.

Si la clave falta o Gemini no responde, el chat muestra un mensaje de indisponibilidad en la interfaz.

## Creado por

Este proyecto fue creado por **Daniel Nomelin Oviedo**.

## Contribuciones

Cine y television

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo LICENSE para más detalles.
