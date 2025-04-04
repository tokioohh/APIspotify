const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const path = require('path');
require('dotenv').config(); // Añadimos soporte para variables de entorno

const app = express();
const port = 3000;

const CLIENT_ID = '07b1a55c7025477daec25298950109aa';
const CLIENT_SECRET = process.env.CLIENT_SECRET; // Obtenemos el CLIENT_SECRET de las variables de entorno
const redirect_uri = 'http://localhost:3000/callback';

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    const scope = 'user-top-read'; // Permiso para leer los artistas más escuchados
    const authUrl = 'https://accounts.spotify.com/authorize?' + 
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: redirect_uri, // Usa la constante definida previamente
        });
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const error = req.query.error || null;

    if (error) {
        console.error('Error en la autenticación:', error);
        return res.status(400).send(`Error al autenticar: ${error}`);
    }

    if (!code) {
        return res.status(400).send('No se proporcionó código de autorización');
    }

    if (!CLIENT_SECRET) {
        console.error('CLIENT_SECRET no está configurado. Asegúrate de definirlo en el archivo .env');
        return res.status(500).send('Error del servidor: CLIENT_SECRET no está configurado');
    }

    try {
        // Intercambiar el código por un access_token
        const tokenResponse = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirect_uri,
            }),
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const accessToken = tokenResponse.data.access_token;
        console.log('Token de acceso obtenido:', accessToken);

        // Redirigir al frontend con el access_token en la URL
        res.redirect(`/?access_token=${accessToken}`);
    } catch (error) {
        // Mejoramos el manejo de errores para obtener más detalles
        if (error.response) {
            console.error('Error al obtener el token - Datos de la respuesta:', error.response.data);
            console.error('Error al obtener el token - Estado:', error.response.status);
            res.status(error.response.status).send(`Error al obtener el token: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error('Error al obtener el token:', error.message);
            res.status(500).send(`Error al obtener el token: ${error.message}`);
        }
    }
});

app.get('/api/top-artists', async (req, res) => {
    const accessToken = req.query.access_token || null;

    if (!accessToken) {
        return res.status(400).json({ error: 'No se proporcionó access_token' });
    }

    try {
        const topArtistsResponse = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            params: {
                limit: 10,
                time_range: 'medium_term',
            },
        });

        const artists = topArtistsResponse.data.items.map(artist => ({
            name: artist.name,
            followers: artist.followers.total,
            genres: artist.genres,
            image: artist.images.length > 0 ? artist.images[0].url : null,
        }));

        res.json(artists);
    } catch (error) {
        if (error.response) {
            console.error('Error - Datos de la respuesta:', error.response.data);
            console.error('Error - Estado:', error.response.status);
            res.status(error.response.status).json({
                error: error.response.data.error || error.response.data,
                status: error.response.status,
            });
        } else {
            console.error('Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log(`1. Visita http://localhost:${port} para empezar`);
});