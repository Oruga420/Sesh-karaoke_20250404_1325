# Solución al Problema del Bucle de Autenticación

Si estás experimentando un bucle donde la aplicación te redirige constantemente a la pantalla de login después de autenticarte con Spotify, sigue estas instrucciones para solucionarlo:

## 1. Asegúrate que todos los servidores están en ejecución

La aplicación necesita tres servidores funcionando simultáneamente:

```bash
# Terminal 1: Frontend React
npm start

# Terminal 2: Servidor de redirección (maneja las callbacks de Spotify)
npm run start-redirect

# Terminal 3: Servidor de API (para las letras)
npm run start-api
```

O usa el comando para iniciar todo a la vez:

```bash
npm run start-all
```

## 2. Borra la caché del navegador y localStorage

1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña "Application" o "Aplicación"
3. En el panel izquierdo, selecciona "Local Storage"
4. Busca "localhost:3000" y borra todos los datos
5. También puedes borrar las cookies y la caché del navegador

## 3. Usa modo incógnito/privado

Abre una ventana de navegación privada y prueba la aplicación allí para evitar problemas con cookies o caché.

## 4. Verifica las URL de redirección

Asegúrate que las URL de redirección coincidan exactamente con las configuradas en tu dashboard de Spotify Developer:

1. URL de redirección: `http://localhost:8888/callback`
2. En la consola del servidor de redirección, verifica que la URL de redirección sea: `http://localhost:3000/callback`

## 5. Flujo de autenticación correcto

El flujo correcto debe ser:

1. Usuario hace clic en "LOGIN WITH SPOTIFY"
2. Redirección a la página de autenticación de Spotify
3. Después de autenticarse, Spotify redirige a `http://localhost:8888/callback`
4. El servidor de redirección captura esta petición y redirige a `http://localhost:3000/callback`
5. El componente Callback en la aplicación React procesa el token y redirige a la página principal
6. La página principal detecta el token y muestra la interfaz de usuario autenticada

Si sigues teniendo problemas, verifica los logs en la consola del navegador (F12) para identificar dónde está fallando el proceso.