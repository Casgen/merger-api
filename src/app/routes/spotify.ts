import express, {Router} from "express";
import {AxiosInstance, AxiosError} from 'axios';
import 'cookie-parser';
import {CorsOptions} from "cors";
import SpotifyWebApi from "spotify-web-api-node";
import * as merger from "../interfaces";

require('dotenv').config();

export const router: Router = express.Router();
const request = require('request');
const axios: AxiosInstance = require('axios');
const cors = require('cors');

const spotifyApi: SpotifyWebApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: `http://localhost:${process.env.PORT}/spotify/auth/callback`
})

var refreshInterval: NodeJS.Timeout;


const generateRandomString = (length: number) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

router.get('/auth/login', (req: express.Request, res: express.Response) => {

    if (spotifyApi.getCredentials().clientId != undefined) {
        let scope = "streaming \
                        user-read-email \
                        user-read-private \
                        user-read-playback-state"

        let state = generateRandomString(32);

        let auth_query_parameters = new URLSearchParams({
            response_type: "code",
            scope: scope,
            redirect_uri: spotifyApi.getCredentials().redirectUri as string,
            state: state,
            client_id: spotifyApi.getCredentials().clientId as string,
        })

        res.redirect('https://accounts.spotify.com/authorize/?' + auth_query_parameters.toString());
        res.end();
        return;
    }
    res.send("Invalid Spotify Client ID!");
    res.end();
})

router.get('/auth/callback', (req: express.Request, res: express.Response, err: express.Errback) => {

    if (req.query.error === undefined) {
        let code = req.query.code;

        let authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: spotifyApi.getCredentials().redirectUri,
                grant_type: 'authorization_code',
            },
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(spotifyApi.getCredentials().clientId + ':' + spotifyApi.getCredentials().clientSecret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            json: true
        };

        request.post(authOptions, (error: Error, response: express.Response, body: any) => {
            if (!error && response.statusCode === 200) {
                spotifyApi.setCredentials({...spotifyApi.getCredentials(), accessToken: body.access_token});
                spotifyApi.setRefreshToken(body.refresh_token);
                refreshInterval = setInterval(refreshSpotifyToken,body.expires_in*1000);
                res.redirect('http://localhost:3000/');
                res.end();
            } else {
                res.status(500);

                res.send({
                    message: "Trying to obtain the access token failed!",
                    stacktrace: err.prototype.stacktrace
                } as merger.Error)

                res.redirect('http://localhost:3000/');
                res.end();
            }
        });
    } else {
        res.status(500);

        res.send({
            message: "Authorization request has failed or been denied!",
            stacktrace: err.prototype.stacktrace
        } as merger.Error)

        res.redirect('http://localhost:3000/');
        res.end();
    }

})

router.get('/refreshToken', () => {
    clearInterval(refreshInterval);
    spotifyApi.refreshAccessToken().then((spRes) => {
        if (spRes.body.refresh_token)
            spotifyApi.setRefreshToken(spRes.body.refresh_token);

        spotifyApi.setAccessToken(spRes.body.access_token);

        refreshInterval = setInterval(refreshSpotifyToken, spRes.body.expires_in*1000);
    }).catch((err) => {
        console.error("failed to refresh the token!", err);
    })
});

router.get('/auth/token', (req: express.Request, res: express.Response) => {
    res.json(spotifyApi.getAccessToken())
})

router.get('/me', (req: express.Request, res: express.Response) => {
    spotifyApi.getMe().then((spRes) => {
        res.json(spRes.body);
        res.end();
    }).catch((err: AxiosError) => {
        res.send(err);
        res.end();
    })
})

router.get('/me/playlists', (req: express.Request, res: express.Response) => {
    spotifyApi.getUserPlaylists().then((spRes) => {
        res.json(spRes.body);
        res.end();
    }).catch((err) => {
        if (err.statusCode) res.status(err.statusCode);
        res.send(err);
        res.end();
    })
})

router.get('/search', (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.query.q !== undefined) {
        spotifyApi.search(req.query.q as string,["album","track","episode","playlist","show","artist"])
            .then((spRes) => {
                res.status(200).send(spRes.body).end();
            }).catch((spErr) => {
                if (spErr.statusCode) res.status(spErr.statusCode)
                res.send(spErr).end();
        })
        return;
    }

    res.status(204);
    res.send({
        message: "query is undefined!",
        stacktrace: err.prototype.stacktrace
    } as merger.Error)
    res.end();
});


router.get('/playlist/:id', (req: express.Request, res: express.Response) => {
    spotifyApi.getPlaylist(req.params.id).then(
        (data) => {
            res.json(data.body);
        },
        (spErr: SpotifyApi.ErrorObject) => {
        })
})

router.get('/album/:id', (req: express.Request, res: express.Response) => {
    spotifyApi.getAlbum(req.params.id).then((data) => {
        res.json(data.body);
    }).catch((spotifyErr: Error) => {
            res.status(500)
            res.send(spotifyErr);
        }
    )
})

router.get('/track/:id', (req: express.Request, res: express.Response, err: express.Errback) => {
    spotifyApi.getTrack(req.params.id).then((data) => {
        res.json(data.body);
    }).catch((spotifyErr: SpotifyApi.ErrorObject) => {
        if (spotifyErr.status)
            res.status(spotifyErr.status);
        res.send(spotifyErr);
    })
})

router.get('/tracks/:ids', (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.params.ids !== undefined) {

        let idArray: Array<string> = req.params.ids.split(",");

        spotifyApi.getTracks(idArray, {}).then((data) => {
            res.json(data.body);
            res.end();
        }).catch((spotifyErr: SpotifyApi.ErrorObject) => {
            if (spotifyErr.status)
                res.status(spotifyErr.status);

            res.send(spotifyErr);
            res.end();
        })
        return;
    }

    res.status(400).send({
        error: "id's are undefined",
        stacktrace: err.prototype.stacktrace
    })

    res.end();
})


router.put('/player/play', (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.query.device_id !== undefined) {
        if (req.body[0] === undefined) {
            spotifyApi.play({
                device_id: req.query.device_id as string
            }).then((spotifyRes) => {
                res.json(spotifyRes.body).end();
            }).catch((spotifyErr) => {
                if (spotifyErr.status)
                    res.status(spotifyErr.status);
                res.send(spotifyErr);
            })
        } else {
            spotifyApi.play({
                uris: req.body as string[],
                device_id: req.query.device_id as string
            }).then((spotifyRes) => {
                res.json(spotifyRes.body).end();
            }).catch((spotifyErr) => {
                if (spotifyErr.statusCode)
                    res.status(spotifyErr.statusCode);
                res.send(spotifyErr);
            })
        }
        return;
    }
    res.status(400).send({
        errorMessage: "Device_id wasn't provided!"
    })
})

router.put('/player/pause', (req: express.Request, res: express.Response, err: express.Errback) => {
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
    let error: merger.Error = {
        message: "Device_id wasn't provided!"
    };
    res.status(400).send(error);
})

router.put('/player/setVolume', (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.body.value !== undefined && req.body.device_id !== undefined) {
        let deviceId: string = req.body.device_id as string;
        let volumePercent: number = req.body.value as unknown as number;
        spotifyApi.setVolume(volumePercent, {device_id: deviceId}).then((spotifyRes) => {
            res.json(spotifyRes)
        }).catch((spErr: SpotifyApi.ErrorObject) => {
            res.status(500).send(spErr);
        })
        return;
    }

    let error: merger.Error = {
        message: "Device_id or value was not provided!",
        stacktrace: err.prototype.stacktrace
    };
    res.status(400).send(error);
})
//TODO: router.get('/playlists',)

router.get("/player/playbackState", (req: express.Request, res: express.Response, err: express.Errback) => {
    spotifyApi.getMyCurrentPlaybackState({market: "ES"}).then((spotifyRes) => {
        res.json(spotifyRes.body);
    }).catch((spErr) => {
        res.status(500).send(spErr);
    })
})

router.put("/player/seek", (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.query.device_id && req.query.position_ms) {
        spotifyApi.seek(req.query.position_ms as unknown as number,
            {device_id: req.query.device_id as unknown as string}
        )
            .then((spotifyRes) => {
                res.status(200).send(spotifyRes.body);
            }).catch((spErr) => {
            res.status(500).send(spErr);
        })
    } else {
        let error: merger.Error = {
            message: "Device_id or value was not provided!",
            stacktrace: err.prototype.stacktrace
        };

        res.status(400).send(error);
    }
});

router.get("/artist/:id", (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.params.id !== undefined) {
        spotifyApi.getArtist(req.params.id).then((spRes) => {
            res.status(200).send(spRes.body);
        }).catch((err) => {
            if (err.statusCode) {
                res.status(err.statusCode)
            } else {
                res.status(500)
            }
            res.send(err);
        })
        return;
    }

    res.status(400).send({
        message: "id is undefined!",
        stacktrace: err.prototype.stacktrace
    } as merger.Error);

    return;
});


router.get("/artist/:id/topTracks", (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.params.id !== undefined) {
        //TODO: Watch out for the available markets. they could be interfering with the result
        spotifyApi.getArtistTopTracks(req.params.id, "ES").then((spRes) => {
            res.status(200).send(spRes.body);
        }).catch((err) => {
            res.status(500).send(err);
        })
        return;
    }


    res.status(400).send({
        message: "id is undefined!",
        stacktrace: err.prototype.stacktrace
    } as merger.Error);

    return;
});

router.get("/artist/:id/albums", (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.params.id !== undefined) {
        spotifyApi.getArtistAlbums(req.params.id, {}).then((spRes) => {
            res.status(200).send(spRes.body);
        }).catch((err) => {
            res.status(500).send(err);
        })
        return;
    }


    res.status(400).send({
        message: "id is undefined!",
        stacktrace: err.prototype.stacktrace
    } as merger.Error);

    return;
});

router.get("/artist/:id/relatedArtists", (req: express.Request, res: express.Response, err: express.Errback) => {
    if (req.params.id !== undefined) {
        //TODO: Watch out for the available markets. they could be interfering with the result
        spotifyApi.getArtistRelatedArtists(req.params.id).then((spRes) => {
            res.status(200).send(spRes.body);
        }).catch((err) => {
            res.status(500).send(err);
        })
        return;
    }

    res.status(400).send({
        message: "id is undefined!",
        stacktrace: err.prototype.stacktrace
    } as merger.Error);

    return;
});

const refreshSpotifyToken = ()  => {
    return spotifyApi.refreshAccessToken().then((spRes) => {
        if (spRes.body.refresh_token)
            spotifyApi.setRefreshToken(spRes.body.refresh_token);

        spotifyApi.setAccessToken(spRes.body.access_token);
    });
}


module.exports = router;
