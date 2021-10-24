import express, { Router } from "express";
import {AxiosResponse, AxiosInstance, Axios, AxiosError} from 'axios';
import 'cookie-parser';

require('dotenv').config();

export const router: Router = express.Router();
const request = require('request');
const axios: AxiosInstance = require('axios');

const spotifyClientId: string | undefined = process.env.SPOTIFY_CLIENT_ID
const spotifyClientSecret: string | undefined = process.env.SPOTIFY_CLIENT_SECRET

const generateRandomString = (length: number) => {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

router.get('/auth/login', (req: express.Request, res: express.Response) => {

    if (spotifyClientId != undefined) { 
        var scope = "streaming \
                        user-read-email \
                        user-read-private"
    
        var state = generateRandomString(32);
    
        var auth_query_parameters = new URLSearchParams({
            response_type: "code",
            scope:scope,
            redirect_uri: `http://localhost:${process.env.PORT}/spotify/auth/callback`,
            state:state,
            client_id:spotifyClientId
        })

        res.redirect('https://accounts.spotify.com/authorize/?' + auth_query_parameters.toString());
        res.end();
    }
    res.send("Invalid Spotify Client ID!");
    res.end();
})

router.get("/",(req:express.Request, res: express.Response) => {
    res.send("Yay You made it!");
    res.end();
})

router.get('/auth/callback', (req: express.Request, res: express.Response) => {

    var code = req.query.code;
  
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: `http://localhost:${process.env.PORT}/spotify/auth/callback`,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(spotifyClientId + ':' + spotifyClientSecret).toString('base64')),
        'Content-Type' : 'application/x-www-form-urlencoded'
      },
      json: true
    };
  
    request.post(authOptions, function(error: Error, response: express.Response, body: any) {
      if (!error && response.statusCode === 200) {
        res.cookie("access_token",body.access_token)
        res.redirect('http://localhost:3000/')
      }
    });
})

router.get('/auth/token', (req: express.Request, res: express.Response) => {
    res.json({access_token: req.cookies.access_token})
})

router.get('/me',(req: express.Request ,res: express.Response) => {
  axios.get("https://api.spotify.com/v1/me", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.cookies.access_token}`,
    } 
  }).then((response: AxiosResponse) => {
    res.json(response.data);
  }).catch((err: AxiosError) => {
    res.send(err);
  })
})

module.exports = router;