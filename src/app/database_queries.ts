import { youtube_v3 } from "@googleapis/youtube";
import {  isSpotifyTrackObject, isSpotifyUri, isYoutubeSearchResult } from "./utils";

export const selectPlaylistByIdAndUser = (id: number, userId: number): string => {
	return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.title, users.username FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE playlists.id = ${id} AND users.id = ${userId};`;
}

export const insertPlaylist = (title = "New Playlist", userId: number, desc = ""): string => {
	return `INSERT INTO playlists (playlists.title,playlists.creator,playlists.desc) VALUES ('${title}',${userId},'${desc}');`
}

export const selectPlaylistsByUser = (userId: number): string => {
	return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.title FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE users.id = ${userId};`;
}

export const selectPlaylistById = (id: number): string => {
	return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.title, users.username FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE playlists.id = ${id};`;
}

export const selectTracksByPlaylistId = (playlistId: number): string => {
	return `SELECT songs.uri, songs.type FROM songs_to_playlists
	LEFT JOIN playlists
	ON songs_to_playlists.playlist_id = playlists.id
	RIGHT JOIN songs
	on songs_to_playlists.song_uri = songs.uri
	WHERE songs_to_playlists.playlist_id = ${playlistId};`;
}

export const insertTrack = (trackUri: string): string => {
	if (isSpotifyUri(trackUri))
		return `INSERT IGNORE INTO songs (songs.uri, songs.type) VALUES ('${trackUri}','S');`;

	return `INSERT IGNORE INTO songs (songs.uri, songs.type) VALUES ('${trackUri}', 'Y');`
}


export const insertSongToUserData = (userId: number, trackUri: string): string => {
	return `INSERT INTO liked_users_songs (liked_users_songs.user_id, liked_users_songs.song_uri) VALUES (${userId},'${trackUri}');`
}

export const selectUserById = (userId: number) => {
	return `SELECT users.username, users.id, users.img FROM users WHERE users.id = ${userId}`
}


export const getLikedSongsByUser = (userId: number): string => {
	return `SELECT songs.uri, songs.type FROM songs
		LEFT JOIN liked_users_songs
		ON songs.uri = liked_users_songs.song_uri
		WHERE liked_users_songs.user_id = ${userId};`
}

export const insertTrackToPlaylist = (track: SpotifyApi.TrackObjectFull | youtube_v3.Schema$Video, playlistId: number): string => {
	if (isSpotifyTrackObject(track))
		return `CALL insertSongIntoPlaylist(${playlistId},'${track.uri}');`

	if (isYoutubeSearchResult(track) && track.id?.videoId)
		return `CALL insertSongIntoPlaylist(${playlistId},'${track.id.videoId}');`;

	return `CALL insertSongIntoPlaylist(${playlistId},'${track.id}');`;
}

