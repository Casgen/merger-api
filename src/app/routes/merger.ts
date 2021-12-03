import express, { Router } from "express";
import {AxiosResponse, AxiosInstance, Axios, AxiosError} from 'axios';
import 'cookie-parser';

export const router: Router = express.Router();

const axios: AxiosInstance = require('axios');

router.get('/me/playlists',(req: express.Request,res: express.Response, err: express.Errback) => {
    axios.get("https://api.spotify.com/v1/me/playlists", {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${req.cookies.access_token}`,
        }
    }).then((response: AxiosResponse) => {
        res.json(response.data);
    }).catch((error: AxiosError) => {
        res.send(error);
    })
})

module.exports = router;