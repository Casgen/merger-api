import express, { Router } from "express";
import {AxiosResponse, AxiosInstance, AxiosError} from 'axios';
import 'cookie-parser';
import { CorsOptions } from "cors";
import SpotifyWebApi from "spotify-web-api-node";
import Merger from "../interfaces";

require('dotenv').config();

export const router: Router = express.Router();
const request = require('request');
const axios: AxiosInstance = require('axios');
const cors = require('cors');

var spotifyApi: SpotifyWebApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: `http://localhost:${process.env.PORT}/spotify/auth/callback`
})

/**
 * THIS NEEDS TO BE DONE PROPERLY AND SECURELY, see https://expressjs.com/en/resources/middleware/cors.html
 */
const corsOptions: CorsOptions = {
  origin: 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

const generateRandomString = (length: number) => {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

router.get('/auth/login', (req: express.Request, res: express.Response) => {

    if (spotifyApi.getCredentials().clientId != undefined) { 
        let scope = "streaming \
                        user-read-email \
                        user-read-private"
    
        let state = generateRandomString(32);
    
        let auth_query_parameters = new URLSearchParams({
            response_type: "code",
            scope:scope,
            redirect_uri: spotifyApi.getCredentials().redirectUri as string,
            state:state,
            client_id:spotifyApi.getCredentials().clientId as string
        })

        res.redirect('https://accounts.spotify.com/authorize/?' + auth_query_parameters.toString());
        res.end();
        return;
    }
    res.send("Invalid Spotify Client ID!");
    res.end();
})

router.get('/refreshToken', (req: express.Request, res: express.Response) => {
    if (spotifyApi.getRefreshToken() !== undefined && spotifyApi.getClientSecret() !== undefined
        && spotifyApi.getClientId() !== undefined) {
        spotifyApi.refreshAccessToken().then(r => {
            res.send(r.body);
        }).catch(e => {
            res.status(500).send(e);
        });
        return;
    }

    let error: Merger.Error = {message: "Credentials aren't defined!"}
    res.status(500).send(error);
});

router.get('/auth/callback', (req: express.Request, res: express.Response) => {

    let code = req.query.code;
  
    let authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: spotifyApi.getCredentials().redirectUri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(spotifyApi.getCredentials().clientId + ':' + spotifyApi.getCredentials().clientSecret).toString('base64')),
        'Content-Type' : 'application/x-www-form-urlencoded'
      },
      json: true
    };

    request.post(authOptions, function(error: Error, response: express.Response, body: any) {
      if (!error && response.statusCode === 200) {
        res.cookie("access_token",body.access_token);
        spotifyApi.setCredentials({...spotifyApi.getCredentials(), accessToken: body.access_token});
        spotifyApi.setRefreshToken(body.refresh_token);
        res.redirect('http://localhost:3000/');
      }
    });
})

router.get('/me',cors(corsOptions),(req: express.Request ,res: express.Response) => {
  axios.get("https://api.spotify.com/v1/me", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.cookies.access_token}`,
    } 
  }).then((response: AxiosResponse) => {
    res.json(response.data);
    res.end();
  }).catch((err: AxiosError) => {
    res.send(err);
    res.end();
  })
})

router.get('/auth/token', (req: express.Request, res: express.Response) => {
    res.json({access_token: spotifyApi.getAccessToken()})
})

router.get('/playlist/:id', cors(corsOptions), (req: express.Request, res: express.Response) => {
  spotifyApi.getPlaylist(req.params.id).then(
  (data) => {
    res.json(data.body);
  },
  (err: SpotifyApi.ErrorObject) => {
    res.status(err.status).send(err);
  })
})

router.get('/album/:id', cors(corsOptions), (req: express.Request, res: express.Response) => {
  spotifyApi.getAlbum(req.params.id).then((data) => {
    res.json(data.body);
  }).catch((spotifyErr: Error) => {
      res.status(500)
      res.send(spotifyErr);
    }
  )
})

router.get('/artist/:id', cors(corsOptions), (req: express.Request, res: express.Response, err: express.Errback) => {
  spotifyApi.getArtist(req.params.id).then(data => {
      res.json(data);
  }).catch(spotifyErr => {
      res.status(spotifyErr.status).send(spotifyErr);
  })
})

router.get('/tracks/:id', cors(corsOptions), (req: express.Request, res: express.Response, err: express.Errback) => {
  spotifyApi.getTrack(req.params.id).then((data) => {
    res.json(data.body);
  }).catch((spotifyErr: SpotifyApi.ErrorObject) => {
      res.status(spotifyErr.status).send(spotifyErr);
  })
})

router.put('/player/play', cors(corsOptions), (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.query.device_id !== undefined) {
        if (req.body[0] === undefined) {
            spotifyApi.play({
                device_id: req.query.device_id as string
            }).then((spotifyRes) => {
                res.json(spotifyRes.body).end();
            }).catch((spotifyErr) => {
                res.status(spotifyErr.status).send(spotifyErr);
            })
        } else {
            spotifyApi.play({
                uris: req.body as string[],
                device_id: req.query.device_id as string
            }).then((spotifyRes) => {
                res.json(spotifyRes.body).end();
            }).catch((spotifyErr: SpotifyApi.ErrorObject) => {
                res.status(spotifyErr.status).send(spotifyErr);
            })
        }
        return;
    }
    res.status(400).send({
        errorMessage: "Device_id wasn't provided!"
    })
})

router.put('/player/pause', cors(corsOptions), (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.query.device_id !== undefined) {
        spotifyApi.pause({
            device_id: req.query.device_id as string
        }).then((spotifyRes) => {
            res.json(spotifyRes.body).end();
        }).catch((spotifyErr) => {
            res.status(spotifyErr.status).send(spotifyErr);
        })
        return;
    }
    let error: Merger.Error = {
        message: "Device_id wasn't provided!"
    };
    res.status(400).send(error);
})

router.put('/player/setVolume', cors(corsOptions), (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.body.value !== undefined && req.body.device_id !== undefined) {
        let deviceId: string = req.body.device_id as string;
        let volumePercent: number = req.body.value as unknown as number;
        spotifyApi.setVolume(volumePercent, {device_id: deviceId}).then((spotifyRes) => {
            res.json(spotifyRes)
        }).catch((spErr: SpotifyApi.ErrorObject) => {
            res.json(spErr.status).send(spErr);
        })
        return;
    }

    let error: Merger.Error = {
        message: "Device_id or value was not provided!",
        stacktrace: err.prototype.stacktrace
    };
    res.status(400).send(error);
})
//router.get('/playlists',)


module.exports = router;