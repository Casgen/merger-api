import { youtube_v3 } from "@googleapis/youtube"

export interface Error {
	status?: number,
	message: string,
	stacktrace?: string,
}

export interface User {
	id: number,
	username: string,
	email?: string,
	password?: string
	img?: string,
}

export interface Playlist {
	id?: number,
	title: string,
	creator: number,
	desc: string
}


export interface PlaylistFull {
	id?: number,
	title: string,
	creator: User,
	desc: string,
	tracks: Array<SpotifyApi.TrackObjectFull | youtube_v3.Schema$Video>
}

export enum Order {
	Random,
	SpotifyFirst,
	YoutubeFirst
}


export enum PlayerType {
	Youtube = 'Y',
	Spotify = 'S'
}

export interface Song {
	uri: string,
	type: PlayerType,
}

